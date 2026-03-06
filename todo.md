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
