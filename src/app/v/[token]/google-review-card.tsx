"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { clickGoogleReview } from "./actions";
import { Button } from "@/components/ui/button";
import { fadeUp, haptic } from "@/components/ui/motion";

const DISMISS_KEY_PREFIX = "google_review_dismissed_";

// Shown to EVERY paid guest when the venue has configured a review link —
// no star-rating gate, no "how was it?" sentiment filter that only sends
// happy customers through, and no incentive/reward language ("get 10% off
// your next visit for a review"). Google's review policies prohibit both:
// gating which customers are asked based on their experience, and
// incentivising reviews in any way. See
// https://support.google.com/business/answer/2622994 ("Don't discourage or
// prohibit negative reviews or selectively solicit positive reviews from
// customers") and the review-gating/incentivised-reviews sections of
// Google's review policy. This card asks everyone, plainly, every time.
export function GoogleReviewCard({
  token,
  restaurantName,
  url,
}: {
  token: string;
  restaurantName: string;
  url: string;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY_PREFIX + token) === "1");
    } catch {
      // Private mode / storage blocked: just show the card — worst case it
      // can't remember a "Maybe later" dismissal across a reload, which is
      // harmless (same tradeoff the arrival animation and BrandIntro make).
      setDismissed(false);
    }
  }, [token]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + token, "1");
    } catch {
      // Ignored — see above.
    }
    setDismissed(true);
  }

  function openReview() {
    haptic();
    // Fire-and-forget: never block or delay the new tab opening below on
    // this write, and never let it failing stop the guest from reviewing.
    void clickGoogleReview(token);
  }

  if (dismissed) return null;

  return (
    <motion.div
      variants={fadeUp}
      className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface shadow-rest px-5 py-4 text-center"
    >
      <p className="text-sm text-ink-soft">
        Enjoyed your meal? A Google review helps <span className="font-medium text-ink">{restaurantName}</span> a
        lot.
      </p>
      <div className="mt-3 space-y-2">
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={openReview} className="block">
          <Button variant="secondary" size="md" full>
            Leave a Google review
          </Button>
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted hover:text-ink underline underline-offset-2"
        >
          Maybe later
        </button>
      </div>
    </motion.div>
  );
}
