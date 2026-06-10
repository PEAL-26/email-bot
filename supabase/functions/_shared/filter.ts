import type { Email, FilterRule } from "./types.ts";

export function matchesRule(email: Email, rule: FilterRule): boolean {
  if (rule.match_from) {
    if (!email.from.toLowerCase().includes(rule.match_from.toLowerCase())) {
      return false;
    }
  }
  if (rule.match_subject) {
    if (!email.subject.toLowerCase().includes(rule.match_subject.toLowerCase())) {
      return false;
    }
  }
  if (rule.match_keyword) {
    if (!email.body.toLowerCase().includes(rule.match_keyword.toLowerCase())) {
      return false;
    }
  }
  return true;
}
