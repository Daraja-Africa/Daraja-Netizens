import { apiFetch } from '../api';
import { fallbackGuides, fallbackSupportContacts } from './fallbackGuides';
import type { Guide, SupportContact } from './types';

/** Curated hub library, with the bundled copy as the cold-start fallback. */
export async function loadGuides(): Promise<Guide[]> {
  try {
    const data = await apiFetch('/api/v1/student/content');
    const items = Array.isArray(data?.items) ? (data.items as Guide[]) : [];
    return items.length ? items : fallbackGuides;
  } catch {
    return fallbackGuides;
  }
}

/** Wellness support cards, with the bundled helplines as the fallback. */
export async function loadSupportContacts(): Promise<SupportContact[]> {
  try {
    const data = await apiFetch('/api/v1/student/support-contacts');
    const contacts = Array.isArray(data?.contacts) ? (data.contacts as SupportContact[]) : [];
    return contacts.length ? contacts : fallbackSupportContacts;
  } catch {
    return fallbackSupportContacts;
  }
}

export function contactHref(contact: SupportContact) {
  const digits = contact.value.replace(/[^\d+]/g, '').replace(/^\+/, '');
  switch (contact.channel) {
    case 'whatsapp':
      return `https://wa.me/${digits}`;
    case 'sms':
      return `sms:${contact.value}`;
    case 'email':
      return `mailto:${contact.value}`;
    case 'url':
      return contact.value;
    default:
      return `tel:${contact.value.replace(/\s+/g, '')}`;
  }
}

export function contactActionLabel(contact: SupportContact) {
  switch (contact.channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'sms':
      return 'Send SMS';
    case 'email':
      return 'Email';
    case 'url':
      return 'Open link';
    default:
      return 'Call';
  }
}
