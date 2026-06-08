export interface EmailAccount {
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  email: string;
  password: string;
}

export interface FilterRule {
  id: string;
  name: string;
  match_from: string | null;
  match_subject: string | null;
  match_keyword: string | null;
  notify_whatsapp: boolean;
  notify_telegram: boolean;
}

export interface Email {
  messageId: string;
  subject: string;
  from: string;
  fromName: string;
  date: Date;
  body: string;
}

export interface NotifierConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  whatsapp?: {
    instanceId: string;
    token: string;
    phone: string;
  };
}

export interface ScanContext {
  supabaseUrl: string;
  supabaseKey: string;
  notifier: NotifierConfig;
}
