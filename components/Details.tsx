import styles from "./Details.module.css";

/* Spec-sheet layout: labelled rows with hairlines, not a grid of cards. */
const ROWS = [
  {
    label: "Formats",
    title: "Read and write nine formats.",
    body: "JSON, CSV, TSV, YAML, XML, HTML, JSX, Markdown and Base64. Convert between formats as your app needs.",
  },
  {
    label: "Metric types",
    title: "Give each field a defined meaning.",
    body: "Use built-in types for counts, numbers, time, ratings, true-or-false values, choices, text, positions and lists.",
  },
  {
    label: "Validation",
    title: "Catch invalid records before importing them.",
    body: "TPP checks values against their metric definitions and reports problems in plain language, including out-of-range values, unknown choices and unrecognized fields.",
  },
  {
    label: "Extensions",
    title: "Add team-specific metrics and file formats.",
    body: "Define a custom metric type or teach TPP to read and write a format your existing scouting system already uses.",
  },
  {
    label: "Your system",
    title: "Keep your scouting app and database.",
    body: "A developer integrates TPP into the app. It returns plain JavaScript records that your app can save in SQL, Firebase or another database.",
  },
];

export default function Details() {
  return (
    <section className={styles.section} data-nav="light">
      <div className="wrap">
        <header className={styles.head}>
          <h2 className={styles.title}>What TPP handles.</h2>
          <p className={styles.sub}>
            TPP handles record structure, validation and conversion. Teams keep their scouting
            app and database.
          </p>
        </header>
        <div className={styles.grid}>
          {ROWS.map((r) => (
            <article key={r.label} className={styles.item}>
              <p className={styles.label}>{r.label}</p>
              <p className="lead"><strong>{r.title}</strong> {r.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
