import React from 'react';
import ShowcaseScreen from '../components/ShowcaseScreen';

// Catch-all: this static export gets embedded at an arbitrary host path
// (e.g. PL@4M's /:brandPathKey/:funnelPathKey), which Expo Router's
// client-side matcher won't resolve to "/". Render the same screen for any
// unmatched path so the export works regardless of where it's served from.
export default function CatchAll() {
  return <ShowcaseScreen />;
}
