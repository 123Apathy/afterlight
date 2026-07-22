import { Redirect } from 'expo-router';
import React from 'react';

// The app lives at /app; `/` is the static landing page (served by Express,
// see server/app.js). This route only renders if the SPA is navigated to `/`
// client-side -- it bounces back into the app so nothing dead-ends here.
export default function Index() {
  return <Redirect href="/app" />;
}
