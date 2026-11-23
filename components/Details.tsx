import styles from "./Details.module.css";

/* Spec-sheet layout: labelled rows with hairlines, not a grid of cards. */
const ROWS = [
  {
    label: "Delivery",
    title: "A record is either on the Pi or still on the tablet.",
    body: "Every record carries an ID. Prism stores it, then acknowledges. Tablets keep anything unacknowledged and resend it on reconnect, and duplicates are dropped by ID. A scout walking out of range mid-upload loses nothing.",
  },
  {
    label: "Reconnect",
    title: "Pair at the first match. Never again.",
    body: "Prism keeps a registry of known devices. When a tablet sleeps between matches and wakes up, it finds the Pi and picks up where it left off.",
  },
  {
    label: "Offline",
    title: "No internet, no access point, no problem.",
    body: "The whole loop runs on the Pi and the radios. That matters at venues where you can't run your own Wi-Fi network: data still moves over Bluetooth.",
  },
  {
    label: "Two-way",
    title: "Push to the stands, not just pull from them.",
    body: "Send the match schedule, scouting assignments or a new form version from your app, and Prism delivers it to every paired device.",
  },
  {
    label: "Schema",
    title: "Prism moves JSON. It doesn't read it.",
    body: "Your scouting form stays your scouting form. Change fields between events without touching Prism.",
  },
];

export default function Details() {
  return (
    <section className={styles.section} data-nav="light">
      <div className="wrap">
        <header className={styles.head}>
          <h2 className={styles.title}>The boring parts, done properly.</h2>
          <p className={styles.sub}>
            Most scouting data goes missing in the same handful of ways. Prism is designed around
            each one.
          </p>
        </header>
        <div className={styles.grid}>
          {ROWS.map((r) => (
            <p key={r.label} className="lead">
              <strong>{r.title}</strong> {r.body}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
