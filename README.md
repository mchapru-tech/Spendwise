# SpendWise — Personal Expense Tracker

A responsive cloud-backed expense tracker using Firebase Authentication and Cloud Firestore.

## Included
- Email/password sign-up and sign-in
- One-time current opening balance setup
- Five expense categories: House, Personal, Transportation, Cat, Food
- Description required for all categories except Transportation
- Date/time saved for each transaction
- Add income (salary and other credits)
- Current balance = opening balance + all recorded income − all recorded expenses
- Monthly savings = selected month's income − expenses
- Daily, weekly, monthly and all-time transaction filters
- Search, edit and delete
- Month-to-month expense comparison
- Monthly category budgets
- CSV is not yet included in this starter version
- Rule-based money assistant (not a generative AI chatbot)

## Setup (Firebase)
1. Go to https://console.firebase.google.com/ and create a project.
2. Add a Web app to the project and copy its Firebase configuration.
3. In Authentication → Sign-in method, enable **Email/Password**.
4. In Firestore Database, create a database.
5. Publish the contents of `firestore.rules` in Firestore → Rules.
6. Copy `firebase-config.example.js` to `firebase-config.js` and fill in your project's config values.
7. Serve the folder from a local web server (ES modules will not run reliably by opening `index.html` directly).

For a quick local server, if Python is installed, run this inside the project folder:
```bash
python -m http.server 8000
```
Then open http://localhost:8000.

## Deploy online
You can host the static files with Firebase Hosting:
1. Install Node.js and Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase login`
3. In this folder run `firebase init hosting`; choose your existing Firebase project and set the public directory to `.`. Configure as a single-page app: **No**.
4. Ensure `firebase-config.js` exists, then run `firebase deploy`.

After deployment, open the Hosting URL on your phone and laptop and sign in with the same account.

## Important notes
- This project does not connect to your bank. You manually enter the opening balance, income and expenses.
- Firebase project setup and deployment require your own account and configuration. No cloud account has been created on your behalf.
- Keep `firebase-config.js` out of public source repositories if you prefer; Firebase web config is not a password, but access must be protected by Authentication and Firestore Security Rules.
- Do not weaken the Firestore rules. Test with two accounts to confirm users cannot see one another's data.
- The assistant currently uses simple local rules over your own recorded totals. For a real AI chatbot, connect a secure backend/API; never place a private AI API key in browser JavaScript.
- Financial calculations depend on complete and accurate manual entries. This is a personal organizer, not a bank statement or accounting service.
