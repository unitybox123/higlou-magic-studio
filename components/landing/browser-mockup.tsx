import Image from "next/image";
import styles from "@/components/landing/landing.module.css";

const STEPS = ["Upload", "Analyze", "Review", "Export"] as const;

export function BrowserMockup() {
  return (
    <div className={styles.mockFrame} aria-hidden="true">
      <div className={styles.mockChrome}>
        <div className={styles.mockTraffic}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.mockUrl}>
          <span className={styles.mockLock} />
          higlou.store/listings/new
        </div>
        <div className={styles.mockChromeSpacer} />
      </div>

      <div className={styles.mockBody}>
        <div className={styles.mockTop}>
          <div>
            <p className={styles.mockEyebrow}>New listing</p>
            <p className={styles.mockHeading}>Review draft</p>
          </div>
          <span className={styles.mockConfidence}>
            <span className={styles.mockConfidenceDot} />
            95% confidence
          </span>
        </div>

        <ol className={styles.mockSteps}>
          {STEPS.map((step, i) => (
            <li
              key={step}
              className={
                i < 2
                  ? styles.mockStepDone
                  : i === 2
                    ? styles.mockStepActive
                    : styles.mockStepIdle
              }
            >
              <span className={styles.mockStepIndex}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className={styles.mockGrid}>
          <div className={styles.mockGallery}>
            <div className={styles.mockHeroShot}>
              <Image
                src="/landing/floodlight.png"
                alt=""
                fill
                sizes="(max-width: 900px) 60vw, 280px"
                className={styles.mockImage}
                priority
              />
              <div className={styles.mockScan} />
            </div>
            <div className={styles.mockThumbs}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.mockThumb}>
                  <Image
                    src="/landing/floodlight.png"
                    alt=""
                    fill
                    sizes="72px"
                    className={styles.mockImage}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.mockFields}>
            <label className={styles.mockField}>
              <span>Title</span>
              <strong>
                LED Security Floodlight Outdoor 50W Motion Sensor Waterproof
              </strong>
            </label>
            <div className={styles.mockFieldRow}>
              <label className={styles.mockField}>
                <span>Price</span>
                <strong>$34.99</strong>
              </label>
              <label className={styles.mockField}>
                <span>Category</span>
                <strong>Home & Garden › Lighting</strong>
              </label>
            </div>
            <div className={styles.mockAiBar}>
              <span className={styles.mockAiPulse} />
              <p>AI filled 14 item specifics from your photos</p>
            </div>
            <div className={styles.mockActions}>
              <span className={styles.mockBtnGhost}>Edit</span>
              <span className={styles.mockBtnSolid}>Export CSV</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
