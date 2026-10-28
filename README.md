# FoodLink

Render hosting and per-service automatic build filters: [deployment guide](docs/render.md).

FoodLink now uses **Cloud Firestore and Firebase Authentication**. The selected
Firebase project is `foodlink-razmaz`, with a Standard Native Firestore database
in Tel Aviv (`me-west1`). No old data migration is required.

The three APIs remain separate, share the `foodlink_core` Firebase layer, and use
Firebase-only entrypoints that do not load Django SQL models or SQLAlchemy.
The customer and management interfaces authenticate using the Firebase Web SDK.

## הפעלה וכיבוי בפקודה אחת

מהתיקייה הראשית של הפרויקט:

```sh
./foodlink start          # הפעלת כל חמשת השירותים ברקע
./foodlink stop           # כיבוי כל השירותים שבניהול הפקודה
./foodlink restart        # הפעלה מחדש
./foodlink status         # מצב השירותים והכתובות
./foodlink logs           # הצגת הלוגים האחרונים
```

אפשר לנהל שירות אחד בלבד:

```sh
./foodlink start frontend
./foodlink stop manager
./foodlink restart dishboard
```

שמות השירותים: `frontend` (אתר הלקוחות, פורט 3000), `manager` (ניהול,
3002), `userbase` (משתמשים, 8001), `dishboard` (מסעדות ותפריטים, 8002),
`orderline` (הזמנות, 8003). הפעלת שירות בודד אינה מפעילה אוטומטית את שאר
השירותים; אתר הלקוחות זקוק לשרתי ה־API כדי לתפקד במלואו.

הפקודות נשארות זהות לאחר שינויי קוד. שרתי הפיתוח טוענים מחדש שינויי קוד
נתמכים; לאחר שינוי הגדרות סביבה השתמשו ב־`restart`. לאחר הוספת תלויות
יש להתקין אותן לפני ההפעלה מחדש. התהליכים ממשיכים לרוץ גם לאחר סגירת
הטרמינל, והמצב והלוגים נשמרים בתיקייה המקומית `.local-services/`.
הכיבוי פועל רק על תהליכים שהפקודה מנהלת. אם הפורט תפוס על ידי תהליך אחר,
תוצג שגיאה בלי לכבות אותו.

המצב הרגיל משתמש ב־Firebase האמיתי של הפרויקט ובקובצי `.env.local`
הקיימים. נדרשים חיבור אינטרנט והרשאות Application Default Credentials.
ההתקנה הראשונית והפעלה ידנית/אמולטורים מתוארות בהמשך.

## Run locally

Create each service's `venv` with Python 3.12 and install its
`requirements.firebase.txt`. Install Java 21+ and the official Firebase CLI for
the emulator workflow. From the repository root:

```sh
python3 scripts/run_firebase.py --emulators
# Separate terminal, demo-only fixture accounts/menu:
PYTHONPATH=. FIREBASE_PROJECT_ID=demo-foodlink \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
UserBase/venv/bin/python scripts/seed_emulator.py
```

Inside `frontend` and `manager-front`, run `npm ci`, then:

```sh
# Customer
REACT_APP_USE_FIREBASE_EMULATORS=true REACT_APP_FIREBASE_PROJECT_ID=demo-foodlink npm start
# Manager (run in manager-front instead)
PORT=3002 REACT_APP_USE_FIREBASE_EMULATORS=true REACT_APP_FIREBASE_PROJECT_ID=demo-foodlink npm start
```

Demo accounts are **only in the emulator**: `admin@example.test` and
`customer@example.test`, password `FoodLink-test-123`. No default production
administrator or production test data is created.

For the real Firebase project, use existing Application Default Credentials
(`gcloud auth application-default login` if needed), run
`python3 scripts/run_firebase.py`, and start the UIs with their ignored
`.env.local` Firebase configuration. Do not set emulator variables in cloud mode.

See [Firebase setup, security and tests](docs/firebase.md).
Legacy SQL entrypoints/models remain for reference and their existing regression
suite; they are not used by the Firebase runtime or root Compose configuration.
