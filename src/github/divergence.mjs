/**
 * Whether the enforced merge-base policy differs from the target branch's own.
 * Advisory: the summary and a workflow warning report it, and no outcome or exit
 * code depends on it. Enforcement reads the merge base, so a target branch whose
 * policy has since changed cannot apply it to this pull request; saying so is
 * worth a warning, while failing every open pull request on a policy edit is
 * not. The branch takes the new policy when it rebases or merges the target.
 *
 * The tip read after the scan is preferred over the one sampled before it:
 * merging into the target branch moves neither the head nor the merge base, so a
 * policy change that lands mid-scan leaves every other check equal.
 *
 * A tip whose configuration does not resolve has no hash, but the pre-scan hash
 * can still prove a difference the live read cannot see: a target tip that held
 * a divergent policy when the scan started and then took a configuration this
 * tool rejects has already been observed to differ, and discarding that would
 * report nothing. Only when neither tip resolved is the target policy genuinely
 * unknown, and an unknown policy is not a difference. An unrelated merge leaves
 * the pre-scan hash equal to the enforced one, so the fallback reports nothing
 * there. An absent record reports nothing: the summary and publication both call
 * this on saved evidence that can be missing either side.
 */
export function policyDiverged(scanned, current) {
  if (!scanned || !current) return false;
  const tipPolicy = current.baseTipPolicyHash ?? scanned.baseTipPolicyHash;
  return (
    typeof tipPolicy === "string" &&
    typeof scanned.policyHash === "string" &&
    scanned.policyHash !== tipPolicy
  );
}
