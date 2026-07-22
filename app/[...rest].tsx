import { Redirect } from 'expo-router';
import React from 'react';

export default function CatchAll() {
  return <Redirect href="/app" />;
}
