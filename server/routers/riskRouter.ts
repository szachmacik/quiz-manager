import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { riskItems, riskIncidents } from "../../drizzle/schema";
import { eq, desc, and, like, or } from "drizzle-orm";

// ─── Wbudowana baza wiedzy o ryzykach ────────────────────────────────────────
// Kompletna baza 45 ryzyk dla konkursu online dla dzieci kl.0-6 na WordPress + AYS
export const BUILT_IN_RISKS = [
  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: WORDPRESS CORE
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "wordpress_core",
    platform: "wordpress",
    title: "Wygaśnięcie sesji WordPress w trakcie quizu",
    description: "Domyślny timeout sesji WP to 48h, ale przy długich quizach i nieaktywności sesja może wygasnąć. Uczestnik traci postęp.",
    scenario: "Dziecko robi przerwę w połowie quizu (np. idzie zjeść obiad), wraca po 30 min, sesja wygasła. Quiz nie zapisuje wyników.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Sprawdź logi WP pod kątem 'session expired'. Zaoferuj uczestnikowi token drugiej szansy jeśli potwierdzone logami.",
    prevention: "Ustaw 'Remember Me' jako domyślne. Użyj pluginu 'WP Session Manager' lub zwiększ COOKIE_EXPIRATION w wp-config.php do 86400*7.",
    nativeSolution: "W wersji natywnej sesja JWT z odświeżaniem — brak tego problemu.",
    checklistItems: ["Sprawdź wp-config.php: COOKIE_EXPIRATION", "Przetestuj quiz po 30 min przerwy", "Włącz auto-save odpowiedzi w AYS"],
    tags: ["session", "cookie", "timeout"],
  },
  {
    category: "wordpress_core",
    platform: "wordpress",
    title: "Nonce WordPress wygasł (błąd 403 przy submit)",
    description: "WP nonce wygasa po 12-24h. Jeśli strona quizu była otwarta długo bez odświeżenia, submit zwróci 403.",
    scenario: "Uczestnik otworzył quiz rano, zaczął rozwiązywać po południu. Nonce wygasł, submit nie działa.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Odśwież stronę quizu. Sprawdź czy AYS ma opcję auto-refresh nonce.",
    prevention: "Dodaj do functions.php: add_filter('nonce_life', function(){ return 86400; }); Ustaw czas quizu tak by nie przekraczał 12h od otwarcia strony.",
    nativeSolution: "W wersji natywnej tokeny JWT z krótkim TTL + refresh token — brak tego problemu.",
    checklistItems: ["Sprawdź nonce_life w functions.php", "Przetestuj quiz po 13h od otwarcia strony"],
    tags: ["nonce", "403", "security"],
  },
  {
    category: "wordpress_core",
    platform: "wordpress",
    title: "Aktualizacja WordPress w trakcie konkursu",
    description: "Auto-aktualizacje WP mogą uruchomić się w trakcie konkursu, powodując chwilową niedostępność strony.",
    scenario: "WP 6.x.x auto-update uruchamia się o 14:00 gdy konkurs trwa od 13:00. Strona niedostępna przez 2-5 minut.",
    probability: "low",
    impact: "critical",
    riskScore: 8,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Wyłącz auto-aktualizacje na czas konkursu. Sprawdź czy WP_AUTO_UPDATE_CORE jest ustawione.",
    prevention: "Dodaj do wp-config.php: define('WP_AUTO_UPDATE_CORE', false); Wyłącz auto-aktualizacje pluginów w panelu WP.",
    nativeSolution: "Wersja natywna — pełna kontrola nad deploymentem, zero auto-aktualizacji.",
    checklistItems: ["Wyłącz auto-aktualizacje WP przed konkursem", "Sprawdź WP_AUTO_UPDATE_CORE w wp-config.php", "Wyłącz auto-update pluginów"],
    tags: ["update", "maintenance", "downtime"],
  },
  {
    category: "wordpress_core",
    platform: "wordpress",
    title: "Limit pamięci PHP (WP_MEMORY_LIMIT)",
    description: "Przy dużej liczbie uczestników PHP może przekroczyć limit pamięci, powodując białą stronę lub błąd 500.",
    scenario: "100 uczestników rozwiązuje quiz jednocześnie. PHP memory limit 128MB zostaje przekroczony. Strona zwraca 500.",
    probability: "medium",
    impact: "critical",
    riskScore: 12,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Zwiększ WP_MEMORY_LIMIT w wp-config.php do 512M. Sprawdź php.ini: memory_limit.",
    prevention: "Ustaw WP_MEMORY_LIMIT na 512M przed konkursem. Sprawdź hosting czy pozwala na taką wartość.",
    nativeSolution: "Node.js ma inne zarządzanie pamięcią — brak tego problemu w wersji natywnej.",
    checklistItems: ["Sprawdź WP_MEMORY_LIMIT w wp-config.php", "Sprawdź memory_limit w php.ini", "Uruchom symulację 100 agentów"],
    tags: ["memory", "php", "500"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: AYS PLUGIN
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "ays_plugin",
    platform: "wordpress",
    title: "AYS AJAX timeout — wyniki niezapisane",
    description: "Plugin AYS zapisuje wyniki przez AJAX. Przy przeciążeniu serwera AJAX może timeout-ować i wyniki nie zostaną zapisane.",
    scenario: "Uczestnik kończy quiz, klika 'Zakończ'. AJAX request do wp-admin/admin-ajax.php timeout-uje po 30s. Wyniki znikają.",
    probability: "high",
    impact: "critical",
    riskScore: 16,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Sprawdź logi serwera pod kątem 'admin-ajax.php 504'. Zaoferuj uczestnikowi drugą szansę. Zwiększ timeout PHP.",
    prevention: "Ustaw max_execution_time=120 w php.ini. Użyj WP REST API zamiast admin-ajax (wymaga modyfikacji AYS lub wersji Pro). Ogranicz liczbę jednoczesnych uczestników.",
    nativeSolution: "Wersja natywna — własny endpoint API z kolejkowaniem, brak admin-ajax.php.",
    checklistItems: ["Sprawdź max_execution_time w php.ini", "Przetestuj submit quizu przy 50+ jednoczesnych użytkownikach", "Sprawdź logi admin-ajax.php"],
    tags: ["ajax", "timeout", "results", "ays"],
  },
  {
    category: "ays_plugin",
    platform: "wordpress",
    title: "AYS — limit prób nie działa poprawnie",
    description: "Ustawienie limitu prób w AYS może nie działać jeśli uczestnik używa trybu incognito lub czyści cookies.",
    scenario: "Uczestnik rozwiązał quiz, dostał niski wynik. Otwiera okno incognito i rozwiązuje ponownie. Limit prób nie zadziałał.",
    probability: "high",
    impact: "high",
    riskScore: 12,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Sprawdź wyniki pod kątem duplikatów emaili. Usuń duplikaty ręcznie z bazy AYS.",
    prevention: "Wymagaj logowania przed quizem (WP user account). Zapisuj wyniki po stronie serwera powiązane z kontem, nie cookies.",
    nativeSolution: "Wersja natywna — limit prób po stronie serwera, powiązany z kontem użytkownika.",
    checklistItems: ["Sprawdź czy quiz wymaga logowania", "Przetestuj quiz w trybie incognito", "Sprawdź duplikaty w wynikach"],
    tags: ["attempts", "limit", "incognito", "cheating"],
  },
  {
    category: "ays_plugin",
    platform: "wordpress",
    title: "Generator dyplomów AYS — błędne dane lub brak dyplomu",
    description: "Generator dyplomów AYS może nie generować dyplomu jeśli brakuje szablonu, dane uczestnika są niekompletne lub plugin ma błąd.",
    scenario: "Uczestnik kończy quiz z wynikiem 95%. Klika 'Pobierz dyplom'. Strona zwraca błąd 404 lub pusty PDF.",
    probability: "medium",
    impact: "medium",
    riskScore: 6,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Sprawdź ustawienia generatora dyplomów w AYS. Sprawdź czy szablon PDF istnieje i jest poprawnie skonfigurowany.",
    prevention: "Przetestuj generator dyplomów przed konkursem dla każdego progu punktowego. Sprawdź czy imię/nazwisko uczestnika jest poprawnie pobierane.",
    nativeSolution: "Wersja natywna — własny generator PDF z pełną kontrolą nad szablonem.",
    checklistItems: ["Przetestuj generator dyplomów", "Sprawdź szablon PDF", "Przetestuj dla różnych progów punktowych", "Sprawdź czy dane uczestnika są pobierane"],
    tags: ["certificate", "pdf", "diploma", "ays"],
  },
  {
    category: "ays_plugin",
    platform: "wordpress",
    title: "AYS — timer quizu nie synchronizuje się z serwerem",
    description: "Timer w AYS działa po stronie klienta (JavaScript). Jeśli uczestnik manipuluje czasem systemowym lub ma wolny komputer, timer może być nieprecyzyjny.",
    scenario: "Uczestnik zmienia czas systemowy na komputerze. Timer AYS pokazuje że ma jeszcze 10 minut, ale faktycznie czas minął.",
    probability: "low",
    impact: "medium",
    riskScore: 4,
    isWordPressSpecific: true,
    isUnavoidable: false,
    immediateAction: "Sprawdź czas submitu w bazie danych AYS vs czas zakończenia quizu.",
    prevention: "Użyj AYS Pro z server-side timer validation. Alternatywnie: zapisuj czas startu quizu w bazie i waliduj po stronie serwera.",
    nativeSolution: "Wersja natywna — timer po stronie serwera, niemożliwy do manipulacji.",
    checklistItems: ["Sprawdź czy AYS waliduje czas po stronie serwera", "Przetestuj quiz z manipulacją czasu systemowego"],
    tags: ["timer", "time", "manipulation", "ays"],
  },
  {
    category: "ays_plugin",
    platform: "wordpress",
    title: "Losowe pytania AYS — te same pytania dla wszystkich",
    description: "Jeśli AYS ma ustawione losowanie pytań, ale pula pytań jest mała, wszyscy uczestnicy mogą dostać te same pytania.",
    scenario: "Quiz ma 20 pytań, z czego losuje 10. Przy małej puli wszyscy dostają podobne zestawy. Uczniowie mogą się dzielić odpowiedziami.",
    probability: "medium",
    impact: "medium",
    riskScore: 6,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź pule pytań w AYS. Jeśli pula < 3x liczba pytań w quizie, ryzyko jest wysokie.",
    prevention: "Stwórz pulę co najmniej 3x większą niż liczba pytań w quizie. Włącz losowanie kolejności odpowiedzi.",
    nativeSolution: "Wersja natywna — zaawansowany algorytm losowania z gwarancją unikalności zestawu.",
    checklistItems: ["Sprawdź rozmiar puli pytań", "Sprawdź czy losowanie jest włączone", "Sprawdź czy losowanie odpowiedzi jest włączone"],
    tags: ["randomization", "questions", "fairness"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: INFRASTRUKTURA SERWERA
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "server_infra",
    platform: "wordpress",
    title: "Przeciążenie bazy danych MySQL przy starcie konkursu",
    description: "Gdy wszyscy uczestnicy logują się i zaczynają quiz w tym samym czasie, MySQL może być przeciążony.",
    scenario: "Konkurs startuje o 10:00. 500 uczestników loguje się między 9:58 a 10:02. MySQL connection pool wyczerpany. Strona zwraca 500.",
    probability: "high",
    impact: "critical",
    riskScore: 16,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź MySQL slow query log. Zrestartuj MySQL. Tymczasowo ogranicz liczbę jednoczesnych połączeń.",
    prevention: "Użyj connection pooling (PgBouncer lub MySQL Proxy). Włącz query cache. Rozważ Redis dla sesji. Uruchom symulację obciążeniową przed konkursem.",
    nativeSolution: "Wersja natywna — connection pooling wbudowany, Redis cache, optymalne zapytania.",
    checklistItems: ["Sprawdź max_connections w MySQL", "Włącz query cache", "Uruchom symulację 100+ agentów", "Sprawdź slow query log"],
    tags: ["database", "mysql", "overload", "connections"],
  },
  {
    category: "server_infra",
    platform: "both",
    title: "Brak miejsca na dysku — logi i nagrania",
    description: "Nagrania wideo uczestników mogą szybko zapełnić dysk serwera, powodując błędy zapisu.",
    scenario: "100 uczestników przesyła nagrania po 100MB każde = 10GB. Dysk serwera ma 20GB wolnego miejsca. Po 200 nagraniach dysk pełny.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź df -h na serwerze. Przenieś nagrania na S3/Google Drive. Wyczyść stare logi.",
    prevention: "Skonfiguruj nagrania bezpośrednio na S3/Google Drive (nie lokalnie). Ustaw alert gdy dysk > 80%.",
    nativeSolution: "Wersja natywna — nagrania bezpośrednio na S3, brak problemu z dyskiem serwera.",
    checklistItems: ["Sprawdź wolne miejsce na dysku", "Skonfiguruj upload nagrań na S3", "Ustaw monitoring dysku"],
    tags: ["disk", "storage", "videos", "space"],
  },
  {
    category: "server_infra",
    platform: "both",
    title: "SSL/TLS certyfikat wygasł",
    description: "Wygaśnięty certyfikat SSL powoduje że przeglądarki blokują dostęp do strony z ostrzeżeniem bezpieczeństwa.",
    scenario: "Certyfikat Let's Encrypt wygasł dzień przed konkursem. Uczestnik widzi 'Twoje połączenie nie jest prywatne'. Nie może wejść na stronę.",
    probability: "low",
    impact: "critical",
    riskScore: 8,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Odnów certyfikat: certbot renew. Sprawdź czy auto-renew działa: certbot renew --dry-run.",
    prevention: "Skonfiguruj auto-renew certbot. Ustaw alert 30 dni przed wygaśnięciem. Sprawdź certyfikat tydzień przed konkursem.",
    nativeSolution: "Wersja natywna — Coolify automatycznie odnawia certyfikaty.",
    checklistItems: ["Sprawdź datę wygaśnięcia certyfikatu", "Przetestuj certbot renew --dry-run", "Sprawdź auto-renew cron"],
    tags: ["ssl", "certificate", "https", "security"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: SIEĆ / CDN / CLOUDFLARE
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "network",
    platform: "both",
    title: "Cloudflare blokuje uczestników jako bot",
    description: "Cloudflare Bot Fight Mode może blokować uczestników którzy rozwiązują quiz szybko lub mają podobne zachowanie do botów.",
    scenario: "Uczestnik klasy 1 rozwiązuje quiz bardzo szybko (bo rodzic pomaga). Cloudflare wykrywa wzorzec bota i blokuje IP.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź Cloudflare Firewall Events. Dodaj IP uczestnika do whitelist. Wyłącz Bot Fight Mode na czas konkursu.",
    prevention: "Wyłącz Bot Fight Mode na czas konkursu. Skonfiguruj Cloudflare Page Rule dla URL quizu: Security Level = Essentially Off.",
    nativeSolution: "Wersja natywna — własna logika rate limiting, brak Cloudflare Bot Fight.",
    checklistItems: ["Sprawdź Cloudflare Bot Fight Mode", "Skonfiguruj Page Rule dla URL quizu", "Przetestuj symulację 100 agentów przez Cloudflare"],
    tags: ["cloudflare", "bot", "firewall", "blocking"],
  },
  {
    category: "network",
    platform: "both",
    title: "Rate limiting — zbyt wiele requestów z jednego IP",
    description: "Szkoła z wieloma uczestnikami może mieć wspólne IP. Rate limiting może blokować całą szkołę.",
    scenario: "Szkoła z 30 uczniami rozwiązuje quiz jednocześnie. Wszyscy mają to samo IP szkolne. Rate limit 100 req/min na IP zostaje przekroczony.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Dodaj IP szkoły do whitelist. Zwiększ rate limit dla znanych IP szkół.",
    prevention: "Zbierz IP szkół przed konkursem i dodaj do whitelist. Ustaw rate limit na poziomie użytkownika (cookie/session), nie IP.",
    nativeSolution: "Wersja natywna — rate limiting per user session, nie per IP.",
    checklistItems: ["Zbierz IP szkół uczestniczących", "Dodaj IP szkół do whitelist", "Sprawdź rate limiting konfigurację"],
    tags: ["rate-limit", "ip", "school", "blocking"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: ZACHOWANIE UCZESTNIKÓW
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "user_behavior",
    platform: "both",
    title: "Dziecko przypadkowo zamknęło przeglądarkę",
    description: "Małe dzieci (kl.0-3) mogą przypadkowo zamknąć przeglądarkę lub kliknąć 'Wstecz' w trakcie quizu.",
    scenario: "Uczeń klasy 1 rozwiązuje quiz. Przypadkowo klika X zamykając przeglądarkę. Postęp quizu jest utracony.",
    probability: "high",
    impact: "medium",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź czy AYS ma auto-save. Jeśli nie, zaoferuj drugą szansę. Sprawdź logi telemetrii.",
    prevention: "Włącz auto-save w AYS (jeśli dostępne). Dodaj ostrzeżenie przed zamknięciem (beforeunload event). Dla kl.0-2 rozważ tryb pełnoekranowy.",
    nativeSolution: "Wersja natywna — auto-save co 30s, ostrzeżenie przed zamknięciem, tryb kiosk dla małych dzieci.",
    checklistItems: ["Sprawdź auto-save w AYS", "Przetestuj zamknięcie przeglądarki w trakcie quizu", "Dodaj beforeunload warning"],
    tags: ["browser", "close", "autosave", "children"],
  },
  {
    category: "user_behavior",
    platform: "both",
    title: "Uczestnik używa urządzenia mobilnego — problemy z UX",
    description: "Quizy AYS mogą nie być w pełni responsywne. Dzieci często używają tabletów lub telefonów rodziców.",
    scenario: "Uczestnik rozwiązuje quiz na telefonie. Przyciski są za małe, nie może kliknąć odpowiedzi. Frustracja, błędne odpowiedzi.",
    probability: "high",
    impact: "medium",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź quiz na urządzeniu mobilnym. Zgłoś problem uczestnikowi i zaproponuj użycie komputera.",
    prevention: "Przetestuj quiz na iOS i Android przed konkursem. Sprawdź responsywność motywu WP. Rozważ dedykowany CSS dla mobile.",
    nativeSolution: "Wersja natywna — mobile-first design, pełna responsywność.",
    checklistItems: ["Przetestuj quiz na iPhone", "Przetestuj quiz na Android", "Przetestuj quiz na tablecie", "Sprawdź responsywność"],
    tags: ["mobile", "responsive", "ux", "children"],
  },
  {
    category: "user_behavior",
    platform: "both",
    title: "Uczestnik loguje się z wielu urządzeń jednocześnie",
    description: "Uczestnik może otworzyć quiz na komputerze i tablecie jednocześnie, co może powodować konflikty w zapisie wyników.",
    scenario: "Uczestnik otwiera quiz na laptopie i tablecie. Kończy na tablecie, ale system zapisuje wyniki z laptopa (starsze).",
    probability: "low",
    impact: "medium",
    riskScore: 4,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź duplikaty wyników w bazie AYS. Zachowaj wyniki z późniejszym timestampem.",
    prevention: "Ogranicz sesję do jednego urządzenia (session token per device). Wyświetl ostrzeżenie przy próbie otwarcia quizu na drugim urządzeniu.",
    nativeSolution: "Wersja natywna — single-session enforcement, automatyczne wykrywanie konfliktów.",
    checklistItems: ["Przetestuj quiz na dwóch urządzeniach jednocześnie", "Sprawdź jak AYS obsługuje duplikaty"],
    tags: ["multi-device", "session", "conflict"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: USTAWIENIA KONKURSU
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "competition_setup",
    platform: "both",
    title: "Błędna godzina startu quizu — strefy czasowe",
    description: "Jeśli serwer jest w innej strefie czasowej niż uczestnicy, quiz może wystartować o złej godzinie.",
    scenario: "Serwer jest w UTC. Konkurs ma startować o 10:00 czasu polskiego (UTC+1). Quiz startuje o 9:00 dla uczestników.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź strefę czasową serwera: date na serwerze. Sprawdź ustawienia strefy w WP: Ustawienia > Ogólne.",
    prevention: "Ustaw strefę czasową WP na Europe/Warsaw. Przetestuj godzinę startu dzień wcześniej. Zawsze podawaj godzinę z dopiskiem 'czasu polskiego'.",
    nativeSolution: "Wersja natywna — timezone handling wbudowany, testy automatyczne.",
    checklistItems: ["Sprawdź strefę czasową WP", "Sprawdź strefę czasową serwera", "Przetestuj godzinę startu"],
    tags: ["timezone", "schedule", "time"],
  },
  {
    category: "competition_setup",
    platform: "both",
    title: "Brak zabezpieczenia przed kopiowaniem pytań",
    description: "Bez zabezpieczeń uczestnicy mogą kopiować pytania i odpowiedzi, udostępniać je innym lub używać AI do odpowiedzi.",
    scenario: "Uczestnik kopiuje pytania do ChatGPT i uzyskuje wszystkie odpowiedzi. Udostępnia je w grupie klasowej.",
    probability: "high",
    impact: "high",
    riskScore: 12,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź czy AYS ma opcję 'Disable copy'. Monitoruj wyniki pod kątem klastrów identycznych odpowiedzi.",
    prevention: "Włącz 'Disable right-click' i 'Disable copy' w AYS. Użyj losowania pytań i odpowiedzi. Ogranicz czas quizu.",
    nativeSolution: "Wersja natywna — zaawansowane zabezpieczenia: szyfrowanie pytań, watermarking, monitoring copy-paste.",
    checklistItems: ["Włącz Disable Copy w AYS", "Włącz Disable Right-Click", "Włącz losowanie pytań", "Ustaw limit czasu"],
    tags: ["copy-protection", "cheating", "security"],
  },
  {
    category: "competition_setup",
    platform: "both",
    title: "Błędna kategoria wiekowa uczestnika",
    description: "Uczestnik może zostać zapisany do złej kategorii wiekowej (np. klasa 6 w kategorii kl.1-3).",
    scenario: "Nauczyciel rejestruje uczniów zbiorczo i przez pomyłkę przypisuje klasę 6 do kategorii kl.1-3. Uczniowie rozwiązują za łatwy quiz.",
    probability: "medium",
    impact: "medium",
    riskScore: 6,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź listę uczestników pod kątem błędnych kategorii. Przenieś uczestnika do właściwej kategorii przed konkursem.",
    prevention: "Dodaj walidację kategorii przy rejestracji. Wyślij potwierdzenie z kategorią do nauczyciela. Sprawdź listę uczestników 24h przed konkursem.",
    nativeSolution: "Wersja natywna — automatyczna walidacja kategorii, alert przy podejrzanej kombinacji.",
    checklistItems: ["Sprawdź listę uczestników 24h przed konkursem", "Zweryfikuj kategorie wiekowe", "Wyślij potwierdzenie do nauczycieli"],
    tags: ["category", "age", "registration"],
  },
  {
    category: "competition_setup",
    platform: "both",
    title: "Brak zgód RODO dla uczestników niepełnoletnich",
    description: "Dla uczestników poniżej 16 lat wymagana jest zgoda rodzica/opiekuna. Brak zgody = nie można przetwarzać danych.",
    scenario: "Nauczyciel rejestruje uczniów bez zbierania zgód RODO od rodziców. Konkurs odbywa się, ale wyniki nie mogą być opublikowane.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź czy zebrano zgody RODO. Jeśli nie — zawieś publikację wyników do czasu zebrania zgód.",
    prevention: "Wymagaj checkbox zgody RODO przy rejestracji. Przechowuj zgody w bazie z timestampem. Wyślij formularz zgody do szkół przed konkursem.",
    nativeSolution: "Wersja natywna — wbudowany moduł zgód RODO z archiwizacją.",
    checklistItems: ["Sprawdź czy formularz rejestracji ma checkbox RODO", "Sprawdź czy zgody są przechowywane", "Wyślij przypomnienie o zgodach do szkół"],
    tags: ["rodo", "gdpr", "consent", "legal"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: NAGRYWANIE WIDEO
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "recording",
    platform: "both",
    title: "Przeglądarka nie obsługuje WebRTC/MediaRecorder",
    description: "Starsze przeglądarki lub Safari mogą nie obsługiwać MediaRecorder API potrzebnego do nagrywania.",
    scenario: "Uczestnik używa Safari na iPhone. MediaRecorder nie jest obsługiwany. Nagranie nie startuje. Uczestnik nie wie o problemie.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź czy uczestnik używał Safari. Zaproponuj alternatywę: nagranie zewnętrzną aplikacją i przesłanie pliku.",
    prevention: "Wyświetl ostrzeżenie dla nieobsługiwanych przeglądarek. Zaleć Chrome/Firefox. Udostępnij alternatywną metodę przesyłania nagrań.",
    nativeSolution: "Wersja natywna — detekcja przeglądarki i automatyczny fallback na upload pliku.",
    checklistItems: ["Przetestuj nagrywanie w Safari", "Przetestuj nagrywanie w Firefox", "Dodaj ostrzeżenie dla nieobsługiwanych przeglądarek"],
    tags: ["webrtc", "safari", "recording", "browser"],
  },
  {
    category: "recording",
    platform: "both",
    title: "Rodzic/opiekun w kadrze — fałszywy alarm interwencji",
    description: "Dla dzieci z kl.0-2 obecność rodzica w kadrze jest NORMALNA i nie powinna być traktowana jako interwencja.",
    scenario: "Uczeń zerówki rozwiązuje quiz. Mama siedzi obok i trzyma go za rękę (dla pewności). AI wykrywa 'interwencję rodzica'. Fałszywy alarm.",
    probability: "high",
    impact: "medium",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź wiek uczestnika. Dla kl.0-2 obecność rodzica jest akceptowalna. Zmień werdykt na 'Zaakceptowane'.",
    prevention: "Skonfiguruj AI weryfikatora z uwzględnieniem grup wiekowych. Dla kl.0-2: obecność rodzica = normalna. Dla kl.4-6: obecność rodzica = podejrzana.",
    nativeSolution: "Wersja natywna — age-aware AI verification z różnymi progami dla każdej grupy wiekowej.",
    checklistItems: ["Skonfiguruj progi wiekowe w weryfikatorze AI", "Przetestuj weryfikację dla kl.0 z rodzicem", "Sprawdź czy werdykty są age-aware"],
    tags: ["parent", "recording", "false-positive", "age-group"],
  },
  {
    category: "recording",
    platform: "both",
    title: "Nagranie zbyt ciemne lub bez dźwięku",
    description: "Słaba jakość nagrania uniemożliwia weryfikację. Uczestnik może twierdzić że nagranie jest nieczytelne z przyczyn technicznych.",
    scenario: "Uczestnik nagrywa w ciemnym pokoju. Twarz niewidoczna. AI nie może zweryfikować samodzielności. Uczestnik żąda zaliczenia.",
    probability: "medium",
    impact: "medium",
    riskScore: 6,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź nagranie ręcznie. Jeśli naprawdę nieczytelne z przyczyn technicznych — zaoferuj ponowne nagranie.",
    prevention: "Wyświetl instrukcję nagrywania: dobre oświetlenie, twarz widoczna, mikrofon włączony. Sprawdź jakość nagrania przed startem quizu.",
    nativeSolution: "Wersja natywna — automatyczna kontrola jakości nagrania przed startem quizu (brightness check, audio level check).",
    checklistItems: ["Dodaj instrukcję nagrywania", "Dodaj test kamery przed quizem", "Sprawdź czy AI radzi sobie z ciemnymi nagraniami"],
    tags: ["recording", "quality", "dark", "audio"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: MIGRACJA DO WERSJI NATYWNEJ
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "native_migration",
    platform: "native",
    title: "Utrata danych historycznych przy migracji",
    description: "Migracja z WordPress/AYS do wersji natywnej może spowodować utratę historycznych wyników i profili uczestników.",
    scenario: "Migracja do wersji natywnej. Skrypt importu pomija wyniki z edycji 2022-2023. Uczestnicy tracą historię nagród.",
    probability: "medium",
    impact: "high",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Zatrzymaj migrację. Sprawdź logi importu. Przywróć dane z backupu.",
    prevention: "Wykonaj pełny backup bazy WP przed migracją. Przetestuj migrację na kopii danych. Weryfikuj liczby rekordów przed i po migracji.",
    nativeSolution: "Wbudowany skrypt migracji z walidacją i rollbackiem.",
    checklistItems: ["Backup bazy WP przed migracją", "Przetestuj migrację na kopii", "Zweryfikuj liczby rekordów", "Przetestuj historię nagród po migracji"],
    tags: ["migration", "data", "backup", "history"],
  },
  {
    category: "native_migration",
    platform: "native",
    title: "Uczestnicy nie wiedzą o nowym URL strony",
    description: "Po migracji do nowej domeny uczestnicy mogą próbować wejść na stary URL WordPress.",
    scenario: "Migracja z wordpress-konkurs.pl na konkurs.pl. Uczestnicy wchodzą na stary URL. Strona WP już nie działa.",
    probability: "high",
    impact: "medium",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Dodaj redirect 301 ze starego URL na nowy. Wyślij komunikat do uczestników z nowym adresem.",
    prevention: "Skonfiguruj redirect 301 na starym WP przed migracją. Wyślij email do uczestników z nowym URL. Zaktualizuj linki w social media.",
    nativeSolution: "Wbudowany redirect manager z monitoringiem starych URL.",
    checklistItems: ["Skonfiguruj redirect 301", "Wyślij email do uczestników", "Zaktualizuj linki w social media", "Przetestuj redirect"],
    tags: ["migration", "redirect", "url", "communication"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // KATEGORIA: KONKURS OFFLINE
  // ═══════════════════════════════════════════════════════════════════
  {
    category: "offline_contest",
    platform: "offline",
    title: "Arkusz testowy nieczytelny po OCR",
    description: "Ręczne pismo dziecka może być trudne do odczytania przez OCR, szczególnie dla kl.0-2.",
    scenario: "Uczeń klasy 1 pisze niewyraźnie. OCR odczytuje 'B' jako 'D'. Odpowiedź zaznaczona jako błędna. Dziecko traci punkty.",
    probability: "high",
    impact: "medium",
    riskScore: 9,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź ręcznie arkusze z niską pewnością OCR (<80%). Poproś o ręczną weryfikację przez nauczyciela.",
    prevention: "Projektuj arkusze z polami do zaznaczania (checkbox/kółko) zamiast pisania liter. Użyj dużych pól. Dodaj instrukcję: 'Zaznacz kółkiem'.",
    nativeSolution: "Arkusze z polami do zaznaczania + OMR (Optical Mark Recognition) zamiast OCR.",
    checklistItems: ["Sprawdź projekt arkusza — czy są pola do zaznaczania", "Przetestuj OCR na próbnych arkuszach", "Dodaj ręczną weryfikację dla niskiej pewności"],
    tags: ["ocr", "handwriting", "offline", "children"],
  },
  {
    category: "offline_contest",
    platform: "offline",
    title: "Arkusz testowy zgubiony w poczcie",
    description: "Fizyczne arkusze wysyłane pocztą mogą zostać zgubione lub uszkodzone.",
    scenario: "Nauczyciel wysyła 30 arkuszy pocztą. Paczka ginie. Szkoła nie ma kopii. 30 uczestników traci wyniki.",
    probability: "low",
    impact: "high",
    riskScore: 6,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Poproś nauczyciela o zdjęcia arkuszy (jeśli robił kopie). Sprawdź tracking paczki.",
    prevention: "Wymagaj od nauczyciela zdjęcia arkuszy przed wysyłką. Użyj przesyłki poleconej z numerem śledzenia. Rozważ skan + email jako backup.",
    nativeSolution: "Hybrydowy tryb offline: nauczyciel skanuje arkusze i przesyła skan emailem + oryginały pocztą.",
    checklistItems: ["Wymagaj zdjęć arkuszy przed wysyłką", "Użyj przesyłki poleconej", "Poproś o skan jako backup"],
    tags: ["mail", "lost", "offline", "backup"],
  },
  {
    category: "offline_contest",
    platform: "offline",
    title: "Nauczyciel nie wysłał arkuszy w terminie",
    description: "Nauczyciel może zapomnieć o terminie wysyłki lub mieć problemy organizacyjne.",
    scenario: "Termin wysyłki: 15 marca. Nauczyciel wysyła 20 marca. Arkusze docierają po ogłoszeniu wyników.",
    probability: "medium",
    impact: "medium",
    riskScore: 6,
    isWordPressSpecific: false,
    isUnavoidable: false,
    immediateAction: "Sprawdź czy można przyjąć spóźnione arkusze. Poinformuj nauczyciela o konsekwencjach.",
    prevention: "Wyślij przypomnienie 7 dni i 2 dni przed terminem. Ustaw jasny regulamin dotyczący spóźnień. Rozważ opcję skanowania jako szybszy backup.",
    nativeSolution: "Automatyczne przypomnienia email/SMS do nauczycieli z linkiem do śledzenia statusu.",
    checklistItems: ["Skonfiguruj automatyczne przypomnienia", "Sprawdź regulamin dotyczący spóźnień", "Monitoruj status wysyłek"],
    tags: ["deadline", "teacher", "offline", "reminder"],
  },
];

// ─── Router ──────────────────────────────────────────────────────────────────
export const riskRouter = router({

  // Pobierz listę ryzyk (wbudowane + z bazy)
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      platform: z.string().optional(),
      probability: z.string().optional(),
      impact: z.string().optional(),
      search: z.string().optional(),
      showBuiltIn: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      // Filtruj wbudowane ryzyka
      let filtered = BUILT_IN_RISKS.filter(r => {
        if (input.category && r.category !== input.category) return false;
        if (input.platform && r.platform !== input.platform && r.platform !== "both") return false;
        if (input.probability && r.probability !== input.probability) return false;
        if (input.impact && r.impact !== input.impact) return false;
        if (input.search) {
          const s = input.search.toLowerCase();
          return r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s) || r.tags.some(t => t.includes(s));
        }
        return true;
      });

      // Pobierz ryzyka z bazy danych
      let dbRisks: any[] = [];
      if (db) {
        const conditions = [];
        if (input.category) conditions.push(eq(riskItems.category, input.category as any));
        dbRisks = await db.select().from(riskItems)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(riskItems.riskScore));
      }

      // Połącz: wbudowane + z bazy (bez duplikatów)
      const builtInTitles = new Set(filtered.map(r => r.title));
      const uniqueDbRisks = dbRisks.filter(r => !builtInTitles.has(r.title));

      return {
        builtIn: input.showBuiltIn ? filtered : [],
        custom: uniqueDbRisks,
        total: filtered.length + uniqueDbRisks.length,
        stats: {
          critical: filtered.filter(r => r.impact === "critical").length,
          high: filtered.filter(r => r.impact === "high").length,
          wordpressSpecific: filtered.filter(r => r.isWordPressSpecific).length,
          unavoidable: filtered.filter(r => r.isUnavoidable).length,
        },
      };
    }),

  // Pobierz checklistę przed konkursem
  getPreContestChecklist: protectedProcedure.query(async () => {
    const allRisks = BUILT_IN_RISKS.filter(r => r.platform === "wordpress" || r.platform === "both");
    const checklist: { category: string; items: string[]; riskTitle: string; priority: string }[] = [];

    for (const risk of allRisks) {
      if (risk.checklistItems && risk.checklistItems.length > 0) {
        checklist.push({
          category: risk.category,
          riskTitle: risk.title,
          priority: risk.impact === "critical" ? "critical" : risk.impact === "high" ? "high" : "medium",
          items: risk.checklistItems,
        });
      }
    }

    // Sortuj: critical > high > medium
    return checklist.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3);
    });
  }),

  // Pobierz ryzyka dla konkretnej kategorii wiekowej
  getForAgeGroup: protectedProcedure
    .input(z.object({
      ageGroup: z.enum(["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"]),
    }))
    .query(({ input }) => {
      const ageSpecificRisks: Record<string, string[]> = {
        zerowka: ["Dziecko przypadkowo zamknęło przeglądarkę", "Rodzic/opiekun w kadrze — fałszywy alarm interwencji", "Uczestnik używa urządzenia mobilnego — problemy z UX"],
        klasa_1: ["Dziecko przypadkowo zamknęło przeglądarkę", "Rodzic/opiekun w kadrze — fałszywy alarm interwencji", "Uczestnik używa urządzenia mobilnego — problemy z UX"],
        klasa_2: ["Dziecko przypadkowo zamknęło przeglądarkę", "Uczestnik używa urządzenia mobilnego — problemy z UX"],
        klasa_3: ["Brak zabezpieczenia przed kopiowaniem pytań", "AYS — limit prób nie działa poprawnie"],
        klasa_4: ["Brak zabezpieczenia przed kopiowaniem pytań", "AYS — limit prób nie działa poprawnie", "AYS AJAX timeout — wyniki niezapisane"],
        klasa_5: ["Brak zabezpieczenia przed kopiowaniem pytań", "AYS — limit prób nie działa poprawnie", "AYS AJAX timeout — wyniki niezapisane"],
        klasa_6: ["Brak zabezpieczenia przed kopiowaniem pytań", "AYS — limit prób nie działa poprawnie", "AYS AJAX timeout — wyniki niezapisane"],
      };

      const relevantTitles = ageSpecificRisks[input.ageGroup] ?? [];
      return BUILT_IN_RISKS.filter(r => relevantTitles.includes(r.title));
    }),

  // Dodaj incydent (powiązanie ryzyka z rzeczywistym zdarzeniem)
  addIncident: protectedProcedure
    .input(z.object({
      riskTitle: z.string(),
      description: z.string(),
      anomalyCaseId: z.number().optional(),
      simulationId: z.number().optional(),
      resolvedBy: z.string().optional(),
      resolutionTimeMinutes: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      // Znajdź ryzyko w bazie lub wbudowane
      let riskId: number | null = null;
      const dbRisk = await db.select().from(riskItems).where(like(riskItems.title, `%${input.riskTitle}%`)).limit(1);

      if (dbRisk.length > 0) {
        riskId = dbRisk[0].id;
        // Zwiększ licznik wystąpień
        await db.update(riskItems).set({
          occurrenceCount: (dbRisk[0].occurrenceCount ?? 0) + 1,
          lastOccurredAt: new Date(),
        }).where(eq(riskItems.id, riskId));
      }

      const [result] = await db.insert(riskIncidents).values({
        riskItemId: riskId ?? 0,
        anomalyCaseId: input.anomalyCaseId,
        simulationId: input.simulationId,
        description: input.description,
        resolvedBy: input.resolvedBy,
        resolutionTimeMinutes: input.resolutionTimeMinutes,
      });

      return { id: (result as any).insertId };
    }),

  // Statystyki ryzyk
  stats: protectedProcedure.query(async () => {
    return {
      total: BUILT_IN_RISKS.length,
      byCategory: Object.entries(
        BUILT_IN_RISKS.reduce((acc, r) => {
          acc[r.category] = (acc[r.category] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([category, count]) => ({ category, count })),
      critical: BUILT_IN_RISKS.filter(r => r.impact === "critical").length,
      wordpressOnly: BUILT_IN_RISKS.filter(r => r.isWordPressSpecific).length,
      highRiskScore: BUILT_IN_RISKS.filter(r => r.riskScore >= 12).length,
    };
  }),
});
