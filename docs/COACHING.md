# Coaching and optional advertising preview

Optional advertising is enabled by default and also enables coaching. Turning ads off locks exercise suggestions and reference vectors; measured scores and basic measurement details remain available. This single preference persists across reloads. Old independent coaching preferences are ignored. If storage is unavailable, the choice remains effective for the session.

The ad space sits below the bottom navigation links. It is explicitly labeled as a preview. Turning advertising off removes it immediately. No ad SDK, tracking request, advertiser account or revenue integration is active.

The coaching add-on appears inside each measured feedback item in “The details that matter.” Keep optional ads enabled in Settings to see two practice ideas selected by exercise family and check category, and a button to show the check's reference angle on the source video. The existing score and measurements remain available when ads are disabled.

The dashed blue segment is constructed from the measured joint and segment length, rotated to the check's angle threshold. It is a 2D threshold illustration, not a personalized ideal pose, correction diagnosis or expected 3D bar trajectory. Front-rack flexion uses the complementary elbow angle. The guide disappears outside the measured sample's time window, when landmarks are unavailable or when the guide would leave the image. A separate control clears it. Saved summaries cannot display it without the original session video and full pose samples.

Exercise ideas are general practice suggestions, not a loading prescription. Pull and receiving suggestions are informed by Catalyst Athletics' [Snatch Pull](https://catalystathletics.com/exercise/97/Snatch-Pull/), [Clean Pull](https://www.catalystathletics.com/exercise/98/Clean-Pull/), [Tall Snatch](https://www.catalystathletics.com/exercise/217/Tall-Snatch/) and [Tall Clean](https://www.catalystathletics.com/exercise/150/Tall-Clean/) references. These sources do not validate the app's scoring thresholds or diagnose the user.

## Before enabling real monetization

No price, payment or subscription is implemented. Coaching access follows the local optional-ad preference. Production advertising still requires a chosen provider and account configuration; disabling ads must gate initialization and requests, not merely hide a loaded ad. The current labeled placeholder generates no revenue.

## Recognition changes

High-hang setup now accepts upright knees and hips when the hands remain near the hips. Subsequent movement evidence is still required: static footage receives no score. First pull and Transition remain not applicable for high-hang variants. For other variants, an unresolved phase remains uncertain rather than being silently relabeled as unnecessary. Missing checks are excluded from the score, not failed. Existing recorded-trace regressions and synthetic static/standing cases check this distinction.

Estimated palm endpoints and their exact midpoint now remain unchanged in storage and metric calculations. Three-point smoothing is restricted to the displayed path, preserves endpoints, and does not cross tracking gaps. This repairs a mismatch that previously caused the history validator to reject smoothed midpoint data.

The hand estimate averages wrist, index and pinky landmarks on each hand. Overlay and metrics share this calculation. Both hands must have visible, in-frame landmarks; missing hands produce gaps rather than wrist substitutions. Existing wrist summaries remain readable and explicitly labeled. Coaching text uses the same font family and 13px size as the surrounding feedback.
