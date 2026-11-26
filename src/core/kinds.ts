import { RequiredKind } from './types';

/**
 * Reads from the wording of a criterion which kind of evidence it asks for.
 *
 * It matters for one reason: a project's pipeline can only prove a criterion that asks
 * for a test run or a build. "All unit tests pass" written in a description should be
 * one of those without anyone setting a field. The reading is narrow on purpose, so a
 * wrong guess is rare, and a person can change the kind of any criterion.
 */

const PASSES = '(?:pass(?:es|ed|ing)?|green|succeed(?:s|ed)?|successful(?:ly)?|clean|no (?:failures|errors))';
const TESTS = '(?:tests?|test suite|specs?|suite)';
const BUILD = '(?:build|ci|pipeline|compil\\w+|lint(?:er|ing)?|type ?check(?:s|ing)?)';

const TEST_RUN = [
  new RegExp(`\\b${TESTS}\\b[^.;]{0,40}\\b${PASSES}\\b`, 'i'),
  new RegExp(`\\b${PASSES}\\b[^.;]{0,25}\\b${TESTS}\\b`, 'i'),
];
const BUILD_RESULT = [
  new RegExp(`\\b${BUILD}\\b[^.;]{0,40}\\b${PASSES}\\b`, 'i'),
  new RegExp(`\\b${PASSES}\\b[^.;]{0,25}\\b${BUILD}\\b`, 'i'),
];
const PULL_REQUEST = /\b(?:pull request|merge request|PR)\b[^.;]{0,40}\b(?:merged|approved|opened|open|reviewed)\b/i;
/** Wording about writing tests or documents is not about a run passing. */
const NOT_A_RUN =
  /\b(?:add(?:s|ed)?|writ(?:e|es|ten)|cover(?:s|ed|age)?|document(?:s|ed)?|describe[sd]?)\b[^.;]{0,30}\btests?\b|\btests?\b[^.;]{0,20}\b(?:added|written|documented|exist)\b/i;

export function kindFor(text: string): RequiredKind {
  const line = text.replace(/\s+/g, ' ').trim();
  if (PULL_REQUEST.test(line)) return 'pull_request';
  if (TEST_RUN.some((pattern) => pattern.test(line)) && !NOT_A_RUN.test(line)) return 'test_run';
  if (BUILD_RESULT.some((pattern) => pattern.test(line))) return 'build';
  return 'any';
}
