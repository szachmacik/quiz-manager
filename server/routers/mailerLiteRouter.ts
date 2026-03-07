import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mailerLiteImports, participants, schools } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── MailerLite API helpers ───────────────────────────────────────────────────

async function fetchMailerLiteSubscribers(apiKey: string, groupId?: string): Promise<any[]> {
  const baseUrl = "https://connect.mailerlite.com/api";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let allSubscribers: any[] = [];
  let cursor: string | null = null;

  do {
    const url = groupId
      ? `${baseUrl}/groups/${groupId}/subscribers?limit=100${cursor ? `&cursor=${cursor}` : ""}`
      : `${baseUrl}/subscribers?limit=100${cursor ? `&cursor=${cursor}` : ""}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MailerLite API error ${res.status}: ${err}`);
    }
    const json = await res.json() as any;
    allSubscribers = allSubscribers.concat(json.data || []);
    cursor = json.meta?.next_cursor || null;
  } while (cursor);

  return allSubscribers;
}

async function fetchMailerLiteGroups(apiKey: string): Promise<any[]> {
  const res = await fetch("https://connect.mailerlite.com/api/groups?limit=100", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`MailerLite groups error ${res.status}`);
  const json = await res.json() as any;
  return json.data || [];
}

// ─── AI field mapper ──────────────────────────────────────────────────────────

async function mapSubscriberFields(sample: any[]): Promise<Record<string, string>> {
  if (!sample.length) return {};
  const fields = Object.keys(sample[0]?.fields || {});
  if (!fields.length) return {};

  const prompt = `Mam listę pól z MailerLite: ${JSON.stringify(fields)}.
Przykładowe dane: ${JSON.stringify(sample[0]?.fields)}.
Dopasuj pola do: firstName, lastName, schoolName, teacherName, teacherEmail, address, city, postalCode, ageGroup, contestEdition.
Zwróć JSON: { "firstName": "pole_mailerlite", ... } — tylko te pola które możesz dopasować z dużą pewnością.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Jesteś ekspertem od mapowania pól danych. Zwróć tylko JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_schema", json_schema: {
      name: "field_mapping",
      strict: true,
      schema: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          schoolName: { type: "string" },
          teacherName: { type: "string" },
          teacherEmail: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          ageGroup: { type: "string" },
          contestEdition: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    }},
  });

  try {
    const content = response.choices?.[0]?.message?.content;
    return JSON.parse(typeof content === "string" ? content : "{}");
  } catch {
    return {};
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const mailerLiteRouter = router({
  // Pobierz grupy z MailerLite
  getGroups: protectedProcedure
    .input(z.object({ apiKey: z.string().min(10) }))
    .query(async ({ input }) => {
      const groups = await fetchMailerLiteGroups(input.apiKey);
      return groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        subscriberCount: g.total || 0,
      }));
    }),

  // Podgląd pól z MailerLite (bez importu)
  previewFields: protectedProcedure
    .input(z.object({
      apiKey: z.string().min(10),
      groupId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const subscribers = await fetchMailerLiteSubscribers(input.apiKey, input.groupId);
      const sample = subscribers.slice(0, 3);
      const fieldMapping = await mapSubscriberFields(sample);
      const allFields = Object.keys(subscribers[0]?.fields || {});
      return {
        totalSubscribers: subscribers.length,
        sampleData: sample.map((s: any) => ({
          email: s.email,
          fields: s.fields,
        })),
        suggestedMapping: fieldMapping,
        availableFields: allFields,
      };
    }),

  // Pełny import uczestników
  importParticipants: protectedProcedure
    .input(z.object({
      apiKey: z.string().min(10),
      groupId: z.string().optional(),
      fieldMapping: z.record(z.string(), z.string()),
      contestEdition: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      // Utwórz rekord importu
      const [importRecord] = await db.insert(mailerLiteImports).values({
        status: "running",
        importedBy: ctx.user?.id,
      });

      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      try {
        const subscribers = await fetchMailerLiteSubscribers(input.apiKey, input.groupId);
        const { fieldMapping } = input;

        for (const sub of subscribers) {
          const fields = sub.fields || {};
          const get = (key: string) => {
            const mapped = fieldMapping[key];
            return mapped ? (fields[mapped] || null) : null;
          };

          const email = sub.email;
          if (!email) { totalSkipped++; continue; }

          // Znajdź lub utwórz szkołę
          let schoolId: number | null = null;
          const schoolName = get("schoolName");
          if (schoolName) {
            const existingSchools = await db.select().from(schools)
              .where(eq(schools.name, schoolName)).limit(1);
            if (existingSchools.length > 0) {
              schoolId = existingSchools[0].id;
            } else {
              const [newSchool] = await db.insert(schools).values({
                name: schoolName,
                city: get("city") || undefined,
                postalCode: get("postalCode") || undefined,
                address: get("address") || undefined,
                teacherName: get("teacherName") || undefined,
                teacherEmail: get("teacherEmail") || undefined,
              });
              schoolId = (newSchool as any).insertId;
            }
          }

          // Upsert uczestnika
          const existing = await db.select().from(participants)
            .where(eq(participants.email, email)).limit(1);

          const ageGroupRaw = get("ageGroup");
          const validAgeGroups = ["zerówka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"];
          const ageGroup = validAgeGroups.includes(ageGroupRaw || "") ? ageGroupRaw as any : null;

          if (existing.length > 0) {
            await db.update(participants)
              .set({
                firstName: get("firstName") || existing[0].firstName,
                lastName: get("lastName") || existing[0].lastName,
                schoolId: schoolId || existing[0].schoolId,
                ageGroup: ageGroup || existing[0].ageGroup,
                notes: input.contestEdition ? `Edycja: ${input.contestEdition}` : existing[0].notes,
                updatedAt: new Date(),
              })
              .where(eq(participants.email, email));
            totalUpdated++;
          } else {
            await db.insert(participants).values({
              email,
              firstName: get("firstName") || "",
              lastName: get("lastName") || "",
              schoolId,
              ageGroup,
              notes: input.contestEdition ? `Edycja: ${input.contestEdition}` : null,
              mailerLiteId: sub.id || null,
            });
            totalImported++;
          }
        }

        // Zaktualizuj rekord importu
        await db.update(mailerLiteImports)
          .set({ status: "completed", totalImported, totalUpdated, totalSkipped })
          .where(eq(mailerLiteImports.id, (importRecord as any).insertId));

        await notifyOwner({
          title: "✅ Import MailerLite zakończony",
          content: `Zaimportowano ${totalImported} nowych, zaktualizowano ${totalUpdated}, pominięto ${totalSkipped} uczestników.`,
        });

        return { success: true, totalImported, totalUpdated, totalSkipped };
      } catch (error) {
        await db.update(mailerLiteImports)
          .set({ status: "failed", errorMessage: String(error) })
          .where(eq(mailerLiteImports.id, (importRecord as any).insertId));
        throw error;
      }
    }),

  // Historia importów
  getImportHistory: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(mailerLiteImports)
      .orderBy(desc(mailerLiteImports.importedAt))
      .limit(20);
  }),
});
