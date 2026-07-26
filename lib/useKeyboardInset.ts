import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// How much of the layout viewport the on-screen keyboard currently covers, in
// px. 0 whenever the keyboard is closed (and always on desktop and native).
//
// Why this exists: the comment sheet is pinned to the layout bottom, and on
// phones the keyboard OWNS that space. The two mobile browsers break in
// different ways:
//
// - iOS Safari (and the WhatsApp in-app WKWebView, which is how most of this
//   app's families arrive) never resizes the layout viewport for the
//   keyboard. It overlays it and "helpfully" pans the page to the focused
//   input, which left people typing into a sheet they could not see.
// - Android Chrome 108+ defaults to resizing only the *visual* viewport
//   (interactive-widget=resizes-visual), so absolute-bottom UI stays put
//   behind the keyboard there too.
//
// The one honest signal both give is window.visualViewport: the keyboard
// overlap is innerHeight - (vv.height + vv.offsetTop). Consumers lift
// bottom-anchored UI by this much. For Android we additionally opt the page
// into resizes-content via the viewport meta (done here at runtime so it
// works under the Metro dev server too, whose HTML shell we don't control),
// after which Android's inset computes to ~0 and the layout handles itself.
export default function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return; // pre-2019 browsers: keyboard behaviour stays as it was

    const meta = document.querySelector('meta[name="viewport"]');
    const content = meta?.getAttribute('content') || '';
    if (meta && !/interactive-widget/.test(content)) {
      meta.setAttribute('content', `${content}, interactive-widget=resizes-content`);
    }

    const update = () => {
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(covered);
      // This app is a fixed full-screen surface: if the browser auto-panned
      // the page to chase the focused input, the whole UI is left in a
      // half-scrolled broken state. Pin it; the lifted sheet does the rest.
      const scroller = document.scrollingElement;
      if (covered > 0 && scroller && scroller.scrollTop > 0) window.scrollTo(0, 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
