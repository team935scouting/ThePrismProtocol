import { PrismMark } from "./Nav";
import styles from "./Download.module.css";

const REPO = "https://github.com/team935scouting/prism-protocol";

export default function Download() {
  return (
    <section className={styles.section} id="download" data-nav="light">
      <div className="wrap">
        <div className={styles.top}>
          <div>
            <p className="eyebrow">Use TPP</p>
            <h2 className={styles.title}>Keep the scouting system you have.</h2>
            <p className={styles.intro}>
              A developer can add TPP to an existing app to read, validate and convert its match
              data. Your team keeps its forms, workflow and database.
            </p>
          </div>
          <div className={styles.actions}>
            <a className={styles.primary} href={REPO}>
              View source and examples
            </a>
            <a className={styles.secondary} href="/beta">
              Join the developer beta
            </a>
          </div>
        </div>

        <div className={styles.cols}>
          <div>
            <h3 className={styles.h3}>For existing scouting apps</h3>
            <p className="lead">
              <strong>Use TPP as the shared data layer.</strong> It gives scouting apps a common
              way to describe metrics and exchange records while each team keeps its own app and
              database.
            </p>
          </div>
          <div className={styles.separate}>
            <h3 className={styles.h3}>The no-code scouting app</h3>
            <p className="lead">
              <strong>That is a separate product direction.</strong> It is intended to let teams
              build scouting workflows without editing code. TPP is the compatibility layer
              beneath it, not the app builder itself.
            </p>
          </div>
        </div>
      </div>

      <footer className={`wrap ${styles.footer}`}>
        <span className={styles.brand}>
          <PrismMark size={16} />
          The Prism Protocol
        </span>
        <nav aria-label="Footer">
          <a href="#protocol">What TPP is</a>
          <a href="#how">How it works</a>
          <a href={REPO}>Source on GitHub</a>
        </nav>
      </footer>
    </section>
  );
}
