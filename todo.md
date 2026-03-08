# AYS Quiz Manager — TODO

## Backend
- [x] Schemat bazy danych: wordpress_connections, quiz_snapshots, quiz_questions, quiz_answers, simulations, simulation_agents, ai_reviews, patch_proposals, reports
- [x] WP REST API connector — pobieranie quizów, pytań, odpowiedzi
- [x] Fallback: bezpośrednie połączenie MySQL z bazą WordPress (konfiguracja w formularzu)
- [x] Moduł kopiowania quizów (snapshot przed testem)
- [x] Moduł weryfikacji AI (LLM analiza pytań i odpowiedzi — strukturalna + AI)
- [x] Silnik symulacji agentów (do 500 wirtualnych uczestników)
- [x] System symulacji: losowe/poprawne/błędne odpowiedzi, mierzenie czasów odpowiedzi, semaphore concurrency
- [x] Moduł tworzenia prywatnej strony testowej w WP (createTestPage)
- [x] Generator raportów JSON
- [x] Protokół zatwierdzeń poprawek (propose → approve/reject → apply)
- [x] Rollback poprawek (przywracanie oryginalnej wartości)
- [x] Powiadomienia właściciela po zakończeniu symulacji/analizy AI
- [x] Auto-synchronizacja quizów (polling/webhook — do implementacji po podłączeniu WP)
- [ ] Eksport raportów PDF

## Frontend
- [x] Dashboard layout z sidebar (DashboardLayout) — 7 sekcji nawigacji
- [x] Strona: Połączenia WordPress (konfiguracja WP URL, login, Application Password, MySQL)
- [x] Strona: Lista quizów z WP (pobieranie, status, tworzenie snapshotów)
- [x] Strona: Snapshoty quizów — szczegóły z pytaniami i odpowiedziami
- [x] Strona: Weryfikacja AI (wyniki analizy, błędy, sugestie, severity)
- [x] Strona: Symulacja agentów (konfiguracja, uruchomienie, monitoring live)
- [x] Dashboard symulacji: wykres histogramu czasów odpowiedzi, pasek postępu, logi agentów, tabela agentów
- [x] Strona: Raporty (lista raportów, podgląd, generowanie)
- [x] Strona: Propozycje poprawek (lista, before/after, zatwierdź/odrzuć/wdróż/cofnij)
- [x] Real-time updates przez polling (symulacja live co 2s)
- [x] Strona: Ustawienia (konfiguracja domeny email agentów, liczba agentów — do dodania)

## Testy
- [x] Testy jednostkowe: WP connector (parseQuestionIds, buildSnapshotHash, generateRandomAnswers)
- [x] Testy jednostkowe: auth.logout
- [ ] Testy jednostkowe: silnik symulacji (do rozszerzenia)
- [ ] Testy jednostkowe: moduł AI review (do rozszerzenia)

## Rozbudowa autonomiczna (faza 2)

### Backend
- [x] Auto-sync polling — cykliczne sprawdzanie zmian w quizach WP (co N minut)
- [x] Diff snapshotów — porównanie dwóch wersji quizu (dodane/usunięte/zmienione pytania)
- [ ] Eksport raportów do PDF (manus-md-to-pdf lub HTML→PDF)
- [ ] Tworzenie prywatnej strony testowej w WP przez REST API
- [x] Harmonogram symulacji (cron-like: uruchom symulację o określonej godzinie)
- [ ] Endpoint webhook dla WP (odbieranie powiadomień o zmianach quizów)
- [ ] Statystyki zbiorcze (dashboard overview — liczby, trendy)
- [ ] Eksport quizu do JSON/CSV (backup portability)

### Frontend
- [x] Panel ustawień (domena agentów, domyślna liczba, interwał auto-sync)
- [x] Diff viewer — wizualne porównanie dwóch snapshotów
- [x] Scheduler UI — planowanie symulacji z datą/godziną
- [ ] Strona testowa WP — przycisk "Utwórz stronę testową" z podglądem shortcode
- [ ] Powiadomienia właściciela — toast + badge w sidebar dla nowych propozycji poprawek
- [ ] Eksport raportu PDF — przycisk na stronie raportów
- [ ] Strona główna dashboard — wykresy trendów, ostatnie aktywności
- [ ] Kopiowanie shortcode do schowka jednym kliknięciem
- [ ] Filtrowanie i sortowanie list (quizy, symulacje, raporty)
- [ ] Status badge auto-sync w sidebar (ostatnia synchronizacja)

## Rozbudowa autonomiczna (faza 3 — v3)

### Backend
- [ ] Eksport raportów do PDF (HTML→PDF przez endpoint /api/reports/:id/pdf)
- [ ] Webhook endpoint dla WordPress (odbieranie powiadomień o zmianach quizów)
- [ ] Eksport quizu do JSON i CSV
- [ ] Endpoint statystyk zbiorczych (trendy: symulacje/tydzień, błędy AI/quiz)
- [ ] Badge counter — liczba oczekujących poprawek w sidebar

### Frontend
- [ ] Wykresy trendów na Home dashboard (Recharts — symulacje, błędy, snapshoty)
- [ ] Kopiowanie shortcode do schowka jednym kliknięciem (Quizy)
- [ ] Filtrowanie i sortowanie list (quizy, symulacje, raporty)
- [ ] Strona testowa WP — przycisk "Utwórz stronę testową" z podglądem shortcode
- [ ] Badge z liczbą oczekujących poprawek w sidebar nawigacji
- [ ] Eksport raportu PDF — przycisk na stronie raportów
- [ ] Eksport quizu JSON/CSV — przycisk na stronie snapshotów
- [ ] Timeline historii zmian quizu (oś czasu snapshotów)
- [ ] Toast powiadomienia dla właściciela (nowe propozycje poprawek)
- [ ] Podgląd quizu jako uczestnik (iframe preview)

## Rozbudowa autonomiczna v4

- [ ] Strona testowa WP — backend: tworzenie/usuwanie prywatnej strony ze shortcode'ami przez WP API
- [ ] Strona testowa WP — frontend: dedykowana strona z podglądem, kodem PHP i statusem
- [ ] Powiadomienia email — alert przy błędach krytycznych AI (severity: critical)
- [ ] Powiadomienia email — alert po zakończeniu symulacji z podsumowaniem wyników
- [ ] Filtry i wyszukiwanie — Quizy/Snapshoty (po nazwie, typie, dacie)
- [ ] Filtry i wyszukiwanie — Symulacje (po statusie, liczbie agentów)
- [ ] Filtry i wyszukiwanie — Analizy AI (po statusie, wyniku)
- [ ] Filtry i wyszukiwanie — Poprawki (po statusie: pending/approved/applied)
- [ ] UX: status indicator połączenia WP w sidebarze
- [ ] UX: podgląd quizu jako uczestnik (iframe preview na stronie testowej)

## Rozbudowa autonomiczna v5

### Audytor ustawień quizu AYS
- [ ] Tabela quizSettingsAudits w schemacie bazy danych
- [ ] Tabela competitionRules (regulamin + intencje twórcy) w schemacie
- [ ] Tabela quizHistoricalSettings (historia ustawień poprzednich quizów) w schemacie
- [ ] Backend: settingsAuditRouter — audyt godzin dostępności, zabezpieczeń, dyplomów, limitów
- [ ] Backend: porównanie ustawień z quizami historycznymi (baza odniesienia)
- [ ] Backend: analiza regulaminu przez AI jako baza intencji twórcy
- [ ] Backend: wykrywanie niezgodności ustawień z regulaminem/historią
- [ ] Frontend: strona QuizSettingsAudit.tsx — panel audytu ustawień
- [ ] Frontend: formularz wprowadzania regulaminu konkursu
- [ ] Frontend: raport niezgodności z sugestiami poprawek ustawień

### Weryfikator nagrań wideo
- [ ] Tabela videoVerifications w schemacie bazy danych
- [ ] Backend: videoVerificationRouter — upload URL, analiza AI wideo
- [ ] Backend: AI analiza wideo (LLM multimodal) — ocena samodzielności dziecka
- [ ] Backend: wykrywanie anomalii (nagłe zmiany tempa, przerwy, obecność osoby trzeciej)
- [ ] Backend: rozróżnienie pomocy technicznej vs merytorycznej
- [ ] Backend: raport z oceną SAMODZIELNIE / WĄTPLIWE / INTERWENCJA
- [ ] Frontend: strona VideoVerifier.tsx — dashboard weryfikatora nagrań
- [ ] Frontend: formularz dodawania nagrania (URL Dropbox/Google Drive/link zewnętrzny)
- [ ] Frontend: wyniki weryfikacji z timeline anomalii i uzasadnieniem AI

## Rozbudowa autonomiczna v5 (rozszerzona)

### Audytor ustawień quizu
- [ ] settingsAuditRouter.ts — backend audytu ustawień AYS
- [ ] competitionRulesRouter.ts — CRUD regulaminów konkursów
- [ ] historicalSettingsRouter.ts — baza historycznych ustawień
- [ ] AI analiza regulaminu → strukturyzacja intencji twórcy
- [ ] Porównanie ustawień quizu z regulaminem i historią przez AI
- [ ] QuizSettingsAudit.tsx — strona audytu ustawień
- [ ] CompetitionRules.tsx — strona zarządzania regulaminami

### Natywna przeglądarka quizu z telemetrią
- [ ] Tabela telemetry_sessions w schemacie bazy danych
- [ ] Tabela telemetry_events (każde zdarzenie behawioralne) w schemacie
- [ ] Backend: telemetryRouter — zapis sesji i eventów
- [ ] Frontend: QuizBrowser.tsx — natywna przeglądarka quizu (iframe WP + overlay telemetrii)
- [ ] Telemetria: ruchy myszy (mousemove co 100ms)
- [ ] Telemetria: kliknięcia (mousedown, mouseup, click z pozycją)
- [ ] Telemetria: klawiatura (keydown, keyup — bez treści, tylko timing)
- [ ] Telemetria: focus/blur na polach formularza
- [ ] Telemetria: scroll position
- [ ] Telemetria: czas między pytaniami
- [ ] Telemetria: wykrywanie przełączania zakładek (visibilitychange)
- [ ] Telemetria: wykrywanie copy-paste (clipboard events)
- [ ] Telemetria: wykrywanie DevTools (window resize anomalies)
- [ ] Nagrywanie sesji: canvas screenshot co 5s (opcjonalnie)
- [ ] AI analiza telemetrii → raport behawioralny

### Weryfikator nagrań wideo
- [ ] videoVerificationRouter.ts — backend weryfikatora
- [ ] AI analiza wideo przez URL (LLM multimodal z vision)
- [ ] Wykrywanie anomalii: obecność drugiej osoby, podpowiedzi
- [ ] Rozróżnienie: pomoc techniczna vs merytoryczna
- [ ] VideoVerifier.tsx — strona weryfikatora nagrań
- [ ] TelemetryDashboard.tsx — dashboard sesji telemetrycznych

## Moduł Wyników Finalnych i Nagród (v6)
- [ ] Tabele DB: participants, schools, awards, award_history, contest_results, shipping_batches
- [ ] Silnik rankingowy (punkty + czas, miejsca 1-3 per kategoria)
- [ ] Lista laureatów (≥90% poprawnych odpowiedzi)
- [ ] Grupowanie uczestników po szkołach do zbiorczej wysyłki
- [ ] Optymalizator wysyłki (paczki zbiorcze per szkoła)
- [ ] System nagród z historią (wykrywanie powtórzeń, flagi "nowa nagroda")
- [ ] Import uczestników z MailerLite (API)
- [ ] Import wyników historycznych z Facebook (CSV/JSON)
- [ ] Import bazy szkół i nauczycieli
- [ ] Panel wyników finalnych z rankingiem
- [ ] Panel laureatów z filtrowaniem
- [ ] Dashboard optymalizacji wysyłki (paczki zbiorcze per szkoła)
- [ ] Dashboard nagród (historia, sugestie, flagi)
- [ ] Eksport wyników do PDF/Excel dla organizatora
- [ ] Eksport listy adresów do wysyłki (CSV)

## Konkurs Offline — Zasada projektowa
# ZASADA: uczestnik (nawet przedszkolak) dostaje TYLKO kartkę + ołówek
# Nauczyciel: drukuje arkusze, zbiera po konkursie, wysyła pocztą
# My: skanujemy, OCR, AI weryfikuje, ranking, wysyłka nagród — wszystko autonomicznie

- [ ] Generator arkuszy PDF (duże litery, obrazki, kółka do zaznaczenia A/B/C/D)
- [ ] Arkusz dla przedszkolaka (rysunki zamiast tekstu, 5-10 pytań)
- [ ] Arkusz dla klas 1-3 (duże litery, proste pytania, 10-15 pytań)
- [ ] Arkusz dla klas 4-6 (standardowy, 15-20 pytań)
- [ ] Arkusz dla klas 7-8 i starszych (zaawansowany, 20-25 pytań)
- [ ] Instrukcja dla nauczyciela (1 strona A4, jak przeprowadzić i odesłać)
- [ ] Koperta adresowa do wydruku (gotowy adres zwrotny)
- [ ] Backend: skanowanie arkuszy (upload zdjęcia/skanu)
- [ ] Backend: OCR odpowiedzi (AI vision — rozpoznawanie zaznaczonych kółek)
- [ ] Backend: weryfikacja OCR (pewność + flaga do ręcznej korekty)
- [ ] Backend: automatyczne punktowanie po OCR
- [ ] Backend: ranking offline (punkty + kolejność wpłynięcia)
- [ ] Backend: optymalizator wysyłki nagród (paczki zbiorcze per szkoła)
- [ ] Frontend: panel zarządzania konkursem offline
- [ ] Frontend: upload skanów (drag & drop, masowy)
- [ ] Frontend: panel korekty OCR (side-by-side: skan + wyniki OCR)
- [ ] Frontend: ranking offline z filtrowaniem
- [ ] Frontend: dashboard wysyłki nagród

## Baza Wiedzy o Ryzykach (Risk Knowledge Base)
- [ ] Tabela risk_items w bazie danych (kategoria, ryzyko, prawdopodobieństwo, skutek, naprawa, prewencja)
- [ ] Tabela risk_incidents (historia zdarzeń powiązanych z ryzykami)
- [ ] Seed: wbudowana baza 40+ ryzyk WordPress/AYS/konkurs
- [ ] riskRouter.ts — CRUD ryzyk, wyszukiwanie, statystyki
- [ ] Frontend: RiskKnowledgeBase.tsx — panel ryzyk z filtrowaniem i statusem
- [ ] Integracja z anomalyRouter — automatyczne powiązanie incydentów z ryzykami

## Grupy wiekowe uczestników
- [ ] Grupy: zerówka (5-6 lat), klasa 1, klasa 2, klasa 3, klasa 4, klasa 5, klasa 6
- [ ] Każda grupa ma inny profil behawioralny (zerówka = rodzic pisze, kl.1-2 = wsparcie rodzica normalne, kl.3-4 = samodzielność rosnąca, kl.5-6 = pełna samodzielność)
- [ ] Progi czasowe i wzorce odpowiedzi dostosowane do wieku
- [ ] Weryfikacja wideo: dla zerówki/kl.1 obecność rodzica jest NORMALNA i nie jest anomalią

## Rozbudowa autonomiczna v7

- [ ] Import uczestników z MailerLite API (router + UI)
- [ ] Webpush powiadomienia (Service Worker + VAPID + backend)
- [ ] Checklista pre-contest (24h przed startem — automatyczna weryfikacja)
- [ ] Google Drive sync nagrań (rclone integration)
- [ ] Historia quizu — timeline wszystkich operacji per quiz
- [ ] Eksport wyników finalnych do PDF
- [ ] Panel "Przed konkursem" z automatyczną weryfikacją
- [ ] Optymalizacja UX nawigacji (grupowanie sekcji w sidebar)
- [ ] Strona główna — sekcja "Wymagane akcje" (co wymaga uwagi)
- [ ] Testy v7

## Finalna rozbudowa v8
- [ ] MailerLite API key — panel ustawień z polem na klucz API i testem połączenia
- [ ] Grupowanie nawigacji — sekcje z separatorami (Quizy, Symulacje, Wyniki, Weryfikacja, Offline, Administracja)
- [ ] Generator dyplomów PDF — spersonalizowane dyplomy dla laureatów z imieniem, wynikiem, datą
- [ ] Autodeploy — konfiguracja Coolify + lista brakujących danych
