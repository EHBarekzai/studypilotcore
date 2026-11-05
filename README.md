# Studypilotcore

Build the production-ready foundation of StudyPilot, a mobile-first AI study planner.

Tasks:

1. Create a clean modern responsive UI system with reusable components, navigation, cards, buttons, forms, modals, empty/loading/error states, and light/dark mode.

2. Implement authentication with email/password and persistent sessions, including login, signup, logout, forgot-password UI, and protected app routes.

3. Set up the database and secure user-scoped data model for users, subjects, tasks, exams, study_sessions, and study_plans. Users must only access their own data.

4. Build a short onboarding flow collecting name, education level, subjects, daily study time, preferred study days/hours, and study goals, with a skip option.

5. Create the main app shell with mobile bottom navigation and desktop sidebar: Dashboard, Tasks, Exams, Calendar, Progress, Settings.

Keep the architecture simple, scalable, and easy to modify. Do not add payments, subscriptions, social features, or unnecessary dependencies.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/967f9264-bba7-4772-9106-31bf359cbc65).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
