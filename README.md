# Check Mate · Video Check

Εφαρμογή για τις αναθέσεις και τις πληρωμές των αγώνων Video Check (challenge).

**Εφαρμογή:** https://tsimpinosbv.github.io/checkmate

**V.C. Tips** (ξεχωριστή εφαρμογή, οδηγός στησίματος): https://tsimpinosbv.github.io/checkmate/vctips.html

**Προσωπικό Ημερολόγιο** (ξεχωριστή εφαρμογή): https://tsimpinosbv.github.io/checkmate/imerologio.html

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
- **Ημερολόγιο** (`imerologio.html`): δεύτερη, ξεχωριστή εφαρμογή για προσωπική χρήση. Κάθε χρήστης γράφει τους δικούς του αγώνες και πληρωμές για να τα συγκρίνει με το Check Mate. Τα δεδομένα είναι ιδιωτικά (ούτε οι διαχειριστές τα βλέπουν) και δεν συνδέονται με τις αναθέσεις. Κοινά είναι μόνο οι λογαριασμοί και οι προτεινόμενες αμοιβές.

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
| `imerologio.html` | Το προσωπικό Ημερολόγιο (δημιουργείται από το `build.py`) |
| `vctips.html` | Το V.C. Tips: βήματα στησίματος, tips, δική του λίστα γηπέδων με αρκτικόλεξα και Google Maps (δημιουργείται από το `build.py`). Ξεχωριστό από τη διαχείριση του Check Mate, το επεξεργάζεται μόνο ο λογαριασμός tsimpinosbv@gmail.com |
| `src/mode-vctips.html`, `vctips.webmanifest`, `icons/vct-*`, `img/videocheck-layout.jpg` | Πηγή, εγκατάσταση και εικόνες του V.C. Tips |
| `src/mode-diary.html` | Πηγή του προσωπικού Ημερολογίου |
| `help/diaxeiristis.html`, `help/Check-Mate-Odigies-Diaxeiristi.pdf` | Οδηγίες με εικόνες για τους διαχειριστές (σελίδα και PDF) |
| `help/imerologio.html`, `help/Check-Mate-Imerologio-Odigies.pdf` | Οδηγίες μόνο για το Ημερολόγιο (σελίδα και PDF) |
| `imerologio.webmanifest`, `icons/diary-*` | Εγκατάσταση του Ημερολογίου ως ξεχωριστής εφαρμογής |
| `src/mode-log.html` | Λειτουργία «Ημερολόγιο αγώνων» (κρυφή, εναλλακτική) |
| `src/parse.js` | Ανάγνωση του Excel με το πρόγραμμα |
| `src/firebase-backend.js` | Είσοδος/εγγραφή, βάση δεδομένων, αποστολή email, εγκατάσταση |
| `build.py` | Ενώνει τα παραπάνω στο `checkmate.html` και στο `imerologio.html` (`python3 build.py`) |
| `firebase-config.js` | Στοιχεία του έργου Firebase |
| `firestore.rules` | Ποιος διαβάζει και γράφει τι στη βάση |
| `apps-script/Code.gs` | Η υπηρεσία αποστολής email (Google Apps Script) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Εγκατάσταση σαν εφαρμογή |
| `capabilities.json` | Δικαιώματα της παλιάς έκδοσης στο claude.ai (μόνο για αναφορά) |
