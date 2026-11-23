import { PrismMark } from "./Nav";
import styles from "./Download.module.css";

const REPO = "https://github.com/team935scouting/ThePrismProtocol";

const BOARDS = [
  { name: "Raspberry Pi 5", radio: "Bluetooth 5.0 / BLE" },
  { name: "Raspberry Pi 4 Model B", radio: "Bluetooth 5.0 / BLE" },
  { name: "Raspberry Pi Zero 2 W", radio: "Bluetooth 4.2 / BLE" },
];

const SETUP = [
  { lead: "Download.", rest: "Get the Prism OS image for your board." },
  { lead: "Flash.", rest: "Write it to a microSD card with Raspberry Pi Imager." },
  { lead: "Power on.", rest: "Open prism.local from any device on the same network." },
];

export default function Download() {
  return (
    <section className={styles.section} id="download" data-nav="light">
      <div className="wrap">
        <div className={styles.top}>
          <div>
            <p className="eyebrow">
              Prism OS
            </p>
            <h2 className={styles.title}>From a microSD card to match one.</h2>
          </div>
          <div className={styles.actions}>
            <a className={styles.primary} href={`${REPO}/releases`}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download Prism OS
            </a>
            <a className={styles.secondary} href={REPO}>
              Source on GitHub
            </a>
          </div>
        </div>

        <div className={styles.cols}>
          <div>
            <h3 className={styles.h3}>Set up</h3>
            <ol className={styles.setup}>
              {SETUP.map((s) => (
                <li key={s.lead} className="lead">
                  <strong>{s.lead}</strong> {s.rest}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className={styles.h3}>Runs on</h3>
            <table className={styles.boards}>
              <tbody>
                {BOARDS.map((b) => (
                  <tr key={b.name}>
                    <th scope="row">{b.name}</th>
                    <td>{b.radio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.fine}>
              Built on Raspberry Pi OS Lite. Any board with an onboard Bluetooth radio, or a
              supported USB adapter, should work.
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
          <a href="#how">How it works</a>
          <a href="#developers">Developers</a>
          <a href={REPO}>GitHub</a>
        </nav>
      </footer>
    </section>
  );
}
