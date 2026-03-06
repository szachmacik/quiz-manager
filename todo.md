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
- [ ] Auto-synchronizacja quizów (polling/webhook — do implementacji po podłączeniu WP)
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
- [ ] Strona: Ustawienia (konfiguracja domeny email agentów, liczba agentów — do dodania)

## Testy
- [x] Testy jednostkowe: WP connector (parseQuestionIds, buildSnapshotHash, generateRandomAnswers)
- [x] Testy jednostkowe: auth.logout
- [ ] Testy jednostkowe: silnik symulacji (do rozszerzenia)
- [ ] Testy jednostkowe: moduł AI review (do rozszerzenia)
