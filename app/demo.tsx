import { Redirect } from 'expo-router';

// Sales-demo entry: everlit.co.za/demo. Loading this path flips the DEMO
// flag for the rest of the tab (see constants/demo.ts, which reads the
// pathname at module init, before this component ever renders) and lands in
// the app proper. A plain redirect is all that is left to do here.
export default function DemoEntry() {
  return <Redirect href="/app" />;
}
