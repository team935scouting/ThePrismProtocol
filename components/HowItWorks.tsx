import styles from "./HowItWorks.module.css";

const SOURCE = `team,match,alliance,station,auto_scored:count,climb:choice,defense:rating
935,qm12,red,1,4,deep,4`;

const METRICS = [
  ["auto_scored", "count"],
  ["climb", "choice"],
  ["defense", "rating · 1–5"],
];

const YAML = `records:
  - team: 935
    match: qm12
    alliance: red
    station: 1
    values:
      auto_scored: 4
      climb: deep
      defense: 4`;

export default function HowItWorks() {
  return (
    <section className={styles.section} id="how" data-nav="light">
      <div className="wrap">
        <header className={styles.head}>
          <div>
            <p className="eyebrow">A match record in TPP</p>
            <h2 className={styles.title}>One match, readable in both apps.</h2>
          </div>
          <p className={styles.sub}>
            TPP reads an existing scouting file, checks its typed metrics, and writes the same
            record in another format. A developer adds TPP to each app that needs to exchange data.
          </p>
        </header>

        <div className={styles.flow}>
          <article className={styles.stage}>
            <p className={styles.stageLabel}>Existing file · CSV</p>
            <h3>Read the match</h3>
            <pre className={styles.code}><code>{SOURCE}</code></pre>
          </article>
          <div className={styles.arrow} aria-hidden="true">→</div>
          <article className={styles.stage}>
            <p className={styles.stageLabel}>TPP · metric definitions</p>
            <h3>Check the values</h3>
            <ul className={styles.metrics}>
              {METRICS.map(([name, type]) => (
                <li key={name}><code>{name}</code><span>{type}</span></li>
              ))}
            </ul>
            <p className={styles.validation}>A defense score of 7 returns: “must be a number from 1 to 5.”</p>
          </article>
          <div className={styles.arrow} aria-hidden="true">→</div>
          <article className={styles.stage}>
            <p className={styles.stageLabel}>Same record · YAML</p>
            <h3>Write it for another app</h3>
            <pre className={styles.code}><code>{YAML}</code></pre>
          </article>
        </div>
        <p className={styles.note}>
          The example shows the match values; a full TPP document also carries event and metric
          definitions. The receiving app keeps its own workflow and database.
        </p>
      </div>
    </section>
  );
}
