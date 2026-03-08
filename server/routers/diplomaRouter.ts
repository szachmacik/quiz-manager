import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// Diploma types
const DIPLOMA_TYPES = {
  winner_1st: { label: "Zwycięzca — I miejsce", color: "#FFD700", borderColor: "#B8860B", ribbon: "🥇" },
  winner_2nd: { label: "Zwycięzca — II miejsce", color: "#C0C0C0", borderColor: "#808080", ribbon: "🥈" },
  winner_3rd: { label: "Zwycięzca — III miejsce", color: "#CD7F32", borderColor: "#8B4513", ribbon: "🥉" },
  laureate: { label: "Laureat Konkursu", color: "#4A90D9", borderColor: "#2C5F8A", ribbon: "⭐" },
  participant: { label: "Uczestnik Konkursu", color: "#6B8E6B", borderColor: "#4A6A4A", ribbon: "📜" },
};

// Age group messages
const AGE_MESSAGES: Record<string, string> = {
  "zerówka": "Brawo! Jesteś wspaniały/a!",
  "klasa_1": "Świetna robota! Jesteś bardzo mądry/a!",
  "klasa_2": "Doskonały wynik! Tak trzymaj!",
  "klasa_3": "Znakomity wynik! Jesteś prawdziwym mistrzem wiedzy!",
  "klasa_4": "Wybitny wynik! Twoja wiedza robi wrażenie!",
  "klasa_5": "Imponujący wynik! Jesteś wzorem dla innych!",
  "klasa_6": "Znakomity wynik! Twoja wiedza i zaangażowanie są godne podziwu!",
};

function generateDiplomaHTML(params: {
  participantName: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  timeTaken?: number;
  place?: number;
  ageGroup?: string;
  contestDate: string;
  contestEdition?: string;
  organizerName?: string;
  diplomaType: keyof typeof DIPLOMA_TYPES;
  customMessage?: string;
}): string {
  const dtype = DIPLOMA_TYPES[params.diplomaType];
  const percentage = Math.round((params.score / params.maxScore) * 100);
  const ageMsg = params.ageGroup ? (AGE_MESSAGES[params.ageGroup] ?? "") : "";
  const message = params.customMessage || ageMsg;
  const organizer = params.organizerName || "Organizator Konkursu";
  const edition = params.contestEdition ? `Edycja ${params.contestEdition}` : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dyplom — ${params.participantName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Open+Sans:wght@400;600&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    width: 297mm;
    height: 210mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f4ef;
    font-family: 'Open Sans', sans-serif;
  }
  
  .diploma {
    width: 280mm;
    height: 195mm;
    background: linear-gradient(135deg, #fffef9 0%, #faf7f0 50%, #fffef9 100%);
    border: 8px solid ${dtype.borderColor};
    border-radius: 4px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20mm 25mm;
    box-shadow: 0 0 0 3px ${dtype.color}, 0 0 0 6px ${dtype.borderColor};
    overflow: hidden;
  }
  
  .corner {
    position: absolute;
    width: 30mm;
    height: 30mm;
    border-color: ${dtype.color};
    border-style: solid;
  }
  .corner-tl { top: 8px; left: 8px; border-width: 3px 0 0 3px; }
  .corner-tr { top: 8px; right: 8px; border-width: 3px 3px 0 0; }
  .corner-bl { bottom: 8px; left: 8px; border-width: 0 0 3px 3px; }
  .corner-br { bottom: 8px; right: 8px; border-width: 0 3px 3px 0; }
  
  .watermark {
    position: absolute;
    font-size: 120px;
    opacity: 0.04;
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    color: ${dtype.borderColor};
    transform: rotate(-30deg);
    pointer-events: none;
    user-select: none;
  }
  
  .ribbon {
    font-size: 48px;
    margin-bottom: 4mm;
    line-height: 1;
  }
  
  .diploma-title {
    font-family: 'Playfair Display', serif;
    font-size: 11pt;
    font-weight: 400;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: ${dtype.borderColor};
    margin-bottom: 2mm;
  }
  
  .diploma-type {
    font-family: 'Playfair Display', serif;
    font-size: 22pt;
    font-weight: 700;
    color: ${dtype.borderColor};
    text-align: center;
    margin-bottom: 4mm;
    line-height: 1.2;
  }
  
  .divider {
    width: 60mm;
    height: 2px;
    background: linear-gradient(90deg, transparent, ${dtype.color}, transparent);
    margin: 3mm auto;
  }
  
  .awarded-to {
    font-size: 9pt;
    color: #666;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 2mm;
  }
  
  .participant-name {
    font-family: 'Playfair Display', serif;
    font-size: 28pt;
    font-weight: 900;
    color: #1a1a1a;
    text-align: center;
    margin-bottom: 3mm;
    line-height: 1.1;
  }
  
  .quiz-info {
    font-size: 10pt;
    color: #444;
    text-align: center;
    margin-bottom: 2mm;
    line-height: 1.5;
  }
  
  .score-badge {
    display: inline-block;
    background: ${dtype.color};
    color: ${dtype.borderColor};
    font-weight: 700;
    font-size: 12pt;
    padding: 2mm 8mm;
    border-radius: 20px;
    margin: 2mm 0 3mm;
    font-family: 'Playfair Display', serif;
  }
  
  .message {
    font-style: italic;
    color: #666;
    font-size: 9pt;
    text-align: center;
    margin-bottom: 4mm;
  }
  
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
    margin-top: auto;
    padding-top: 4mm;
    border-top: 1px solid ${dtype.color}44;
  }
  
  .footer-item {
    text-align: center;
    flex: 1;
  }
  
  .footer-label {
    font-size: 7pt;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 1mm;
  }
  
  .footer-value {
    font-size: 9pt;
    color: #444;
    font-weight: 600;
  }
  
  .signature-line {
    width: 40mm;
    height: 1px;
    background: #999;
    margin: 0 auto 1mm;
  }
  
  @media print {
    body { background: white; }
    .diploma { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="diploma">
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>
  <div class="watermark">★</div>
  
  <div class="ribbon">${dtype.ribbon}</div>
  <div class="diploma-title">Dyplom</div>
  <div class="diploma-type">${dtype.label}</div>
  <div class="divider"></div>
  
  <div class="awarded-to">przyznany</div>
  <div class="participant-name">${params.participantName}</div>
  
  <div class="quiz-info">
    za udział w konkursie <strong>${params.quizTitle}</strong>${edition ? `<br>${edition}` : ""}
    ${params.place ? `<br>zajmując <strong>${params.place}. miejsce</strong>` : ""}
  </div>
  
  <div class="score-badge">Wynik: ${params.score}/${params.maxScore} pkt (${percentage}%)</div>
  
  ${message ? `<div class="message">"${message}"</div>` : ""}
  
  <div class="footer">
    <div class="footer-item">
      <div class="footer-label">Data</div>
      <div class="footer-value">${params.contestDate}</div>
    </div>
    <div class="footer-item">
      <div class="signature-line"></div>
      <div class="footer-label">Podpis organizatora</div>
      <div class="footer-value">${organizer}</div>
    </div>
    <div class="footer-item">
      <div class="footer-label">Wynik</div>
      <div class="footer-value">${percentage}%</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export const diplomaRouter = router({
  // Generate single diploma HTML (for preview/print)
  generate: publicProcedure
    .input(z.object({
      participantName: z.string(),
      quizTitle: z.string(),
      score: z.number(),
      maxScore: z.number(),
      timeTaken: z.number().optional(),
      place: z.number().optional(),
      ageGroup: z.string().optional(),
      contestDate: z.string(),
      contestEdition: z.string().optional(),
      organizerName: z.string().optional(),
      diplomaType: z.enum(["winner_1st", "winner_2nd", "winner_3rd", "laureate", "participant"]),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const html = generateDiplomaHTML(input);
      return { html, success: true };
    }),

  // Generate personalized message via AI for a participant
  generateMessage: publicProcedure
    .input(z.object({
      participantName: z.string(),
      ageGroup: z.string(),
      score: z.number(),
      maxScore: z.number(),
      place: z.number().optional(),
      quizTitle: z.string(),
    }))
    .mutation(async ({ input }) => {
      const percentage = Math.round((input.score / input.maxScore) * 100);
      const ageLabels: Record<string, string> = {
        "zerówka": "5-6 lat (przedszkole)",
        "klasa_1": "7 lat (klasa 1)",
        "klasa_2": "8 lat (klasa 2)",
        "klasa_3": "9 lat (klasa 3)",
        "klasa_4": "10 lat (klasa 4)",
        "klasa_5": "11 lat (klasa 5)",
        "klasa_6": "12 lat (klasa 6)",
      };
      const ageLabel = ageLabels[input.ageGroup] ?? input.ageGroup;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Jesteś redaktorem dyplomów konkursowych dla dzieci. Tworzysz krótkie, ciepłe, motywujące wiadomości na dyplomy. Wiadomość powinna być:
- Dostosowana do wieku dziecka
- Maksymalnie 2 zdania
- Ciepła i motywująca
- Bez emoji
- W języku polskim
- Odpowiednia do wydruku na dyplomie`
          },
          {
            role: "user",
            content: `Napisz wiadomość na dyplom dla uczestnika:
- Imię: ${input.participantName}
- Wiek: ${ageLabel}
- Quiz: ${input.quizTitle}
- Wynik: ${input.score}/${input.maxScore} (${percentage}%)
${input.place ? `- Miejsce: ${input.place}` : "- Laureat (≥90%)"}

Napisz tylko samą wiadomość, bez cudzysłowów.`
          }
        ]
      });

      const message = response.choices?.[0]?.message?.content ?? "";
      return { message: typeof message === "string" ? message : "" };
    }),

  // Batch generate diplomas for all laureates/winners of a contest
  batchGenerate: publicProcedure
    .input(z.object({
      contestants: z.array(z.object({
        participantName: z.string(),
        score: z.number(),
        maxScore: z.number(),
        timeTaken: z.number().optional(),
        place: z.number().optional(),
        ageGroup: z.string().optional(),
        diplomaType: z.enum(["winner_1st", "winner_2nd", "winner_3rd", "laureate", "participant"]),
      })),
      quizTitle: z.string(),
      contestDate: z.string(),
      contestEdition: z.string().optional(),
      organizerName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const diplomas = input.contestants.map(c => ({
        participantName: c.participantName,
        html: generateDiplomaHTML({
          ...c,
          quizTitle: input.quizTitle,
          contestDate: input.contestDate,
          contestEdition: input.contestEdition,
          organizerName: input.organizerName,
        }),
      }));

      // Notify owner
      await notifyOwner({
        title: `Wygenerowano ${diplomas.length} dyplomów`,
        content: `Quiz: ${input.quizTitle} | Edycja: ${input.contestEdition ?? "-"} | Data: ${input.contestDate}`,
      });

      return { diplomas, count: diplomas.length, success: true };
    }),

  // Get diploma types
  getTypes: publicProcedure.query(() => {
    return Object.entries(DIPLOMA_TYPES).map(([key, val]) => ({
      key,
      ...val,
    }));
  }),

  // Get age groups
  getAgeGroups: publicProcedure.query(() => {
    return Object.entries(AGE_MESSAGES).map(([key, message]) => ({
      key,
      label: key.replace("_", " ").replace("zerówka", "Zerówka"),
      defaultMessage: message,
    }));
  }),
});
