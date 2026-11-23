import { migrate } from '../store/schema';

/** Runs when the app is installed on a site: creates the tables. */
export async function onInstalled(): Promise<void> {
  const applied = await migrate();
  console.log(`Proof of Done: schema ready after install. Applied: ${applied.join(', ') || 'nothing new'}.`);
}

/**
 * Runs once a day. A new version of the app reaches a site without any event, so this
 * is what applies schema changes that no query has tripped over yet.
 */
export async function maintenance(): Promise<void> {
  const applied = await migrate();
  if (applied.length) console.log(`Proof of Done: applied ${applied.join(', ')}.`);
}
