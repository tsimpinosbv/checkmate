# Check Mate · Video Check

Εφαρμογή για τις αναθέσεις και τις πληρωμές των αγώνων Video Check (challenge).

**Εφαρμογή:** https://tsimpinosbv.github.io/checkmate

## Οδηγίες

| Για ποιον | Αρχείο |
|---|---|
| **Διαχειριστές**: αναθέσεις, Excel, άτομα, χρήστες, αμοιβές, πληρωμές, email, εξαγωγή | [docs/diaxeiristis.md](docs/diaxeiristis.md) |
| **Χρήστες** (χειριστές και βοηθοί): εγγραφή, είσοδος, εγκατάσταση, οι αναθέσεις μου | [docs/xristis.md](docs/xristis.md) |
| **Τεχνικά και συντήρηση**: Firebase, email, αλλαγή αποστολέα, νέος διαχειριστής, διαγραφή λογαριασμού, ενημέρωση κώδικα, προβλήματα | [docs/texnika.md](docs/texnika.md) |

## Με μια ματιά

- Ο **διαχειριστής** φτιάχνει το πρόγραμμα (χειροκίνητα ή από Excel), ορίζει ποιος δουλεύει σε κάθε αγώνα ως **Χειριστής** ή **Βοηθός**, και σημειώνει τις πληρωμές.
- Κάθε **χρήστης** κάνει εγγραφή, συνδέεται με το όνομά του και βλέπει **μόνο τις δικές του αναθέσεις**, και μόνο όσες ο διαχειριστής έχει ορίσει ως ορατές.
- Όταν αλλάζει μια ανάθεση, τα άτομα της ανάθεσης παίρνουν **email** από το videochallengemate@gmail.com.
- Αμοιβές: **Χειριστής 80 €**, **Βοηθός 40 €** (αλλάζουν από τον διαχειριστή).
- Λειτουργεί σε υπολογιστή, tablet και κινητό, και **εγκαθίσταται σαν εφαρμογή**.

## Χρήσιμοι σύνδεσμοι

- Εφαρμογή: https://tsimpinosbv.github.io/checkmate
- Firebase (χρήστες, βάση δεδομένων): https://console.firebase.google.com/project/checkmate-33472
- Λογαριασμοί χρηστών: https://console.firebase.google.com/project/checkmate-33472/authentication/users
- Υπηρεσία email (στον λογαριασμό videochallengemate@gmail.com): https://script.google.com

## Αρχεία του repository

| Αρχείο | Τι είναι |
|---|---|
| `checkmate.html` | Η έτοιμη σελίδα της εφαρμογής (δημιουργείται από το `build.py`, δεν το αλλάζεις με το χέρι) |
| `index.html` | Ανακατεύθυνση στο `checkmate.html` |
| `src/mode-assign.html` | Λειτουργία «Αναθέσεις διαχειριστή» (η κύρια) |
| `src/mode-log.html` | Λειτουργία «Ημερολόγιο αγώνων» (κρυφή, εναλλακτική) |
| `src/parse.js` | Ανάγνωση του Excel με το πρόγραμμα |
| `src/firebase-backend.js` | Είσοδος/εγγραφή, βάση δεδομένων, αποστολή email, εγκατάσταση |
| `build.py` | Ενώνει τα παραπάνω στο `checkmate.html` (`python3 build.py`) |
| `firebase-config.js` | Στοιχεία του έργου Firebase |
| `firestore.rules` | Ποιος διαβάζει και γράφει τι στη βάση |
| `apps-script/Code.gs` | Η υπηρεσία αποστολής email (Google Apps Script) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Εγκατάσταση σαν εφαρμογή |
| `capabilities.json` | Δικαιώματα της παλιάς έκδοσης στο claude.ai (μόνο για αναφορά) |
