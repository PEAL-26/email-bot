import type { EmailAccount, FilterRule } from "./types.ts";

let _supabase: any = null;

async function getClient(url: string, key: string) {
  if (!_supabase) {
    const { createClient } = await import("@supabase/supabase-js");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function getActiveAccounts(
  url: string,
  key: string,
): Promise<EmailAccount[]> {
  const supabase = await getClient(url, key);
  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("active", true);

  if (error) throw error;
  return data ?? [];
}

export async function getActiveRules(
  url: string,
  key: string,
): Promise<FilterRule[]> {
  const supabase = await getClient(url, key);
  const { data, error } = await supabase
    .from("filter_rules")
    .select("*")
    .eq("active", true);

  if (error) throw error;
  return data ?? [];
}

export async function isAlreadyNotified(
  url: string,
  key: string,
  accountId: string,
  messageId: string,
): Promise<boolean> {
  const supabase = await getClient(url, key);
  const { data } = await supabase
    .from("notified_emails")
    .select("id")
    .eq("account_id", accountId)
    .eq("message_id", messageId)
    .maybeSingle();

  return !!data;
}

export async function registerNotification(
  url: string,
  key: string,
  params: {
    account_id: string;
    message_id: string;
    subject: string;
    from_address: string;
    matched_rule: string | null;
  },
): Promise<void> {
  const supabase = await getClient(url, key);
  const { error } = await supabase.from("notified_emails").upsert(params);
  if (error) throw error;
}
