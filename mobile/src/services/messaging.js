/* ============================================================
   Kobciye — canonical messaging (Fariimaha, Live Mode)

   Reads/writes the canonical conversations / conversation_members /
   messages tables under the caller's own JWT — RLS + DB guards are the
   authority (members only, same school only). Replaces the runtime demo
   MESSAGES arrays in Live Mode:

     • an empty school shows “Weli wada-hadal ma jiro.” — no fake
       contacts, conversations, unread counts or voice notes, ever
     • unread state comes from conversation_members.last_read_at
     • text messages persist (each load re-reads Supabase)
     • voice/attachment sending is NOT simulated in Live Mode

   No Phase 5 expansion: no notifications, SMS or WhatsApp.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';

function requireClient() {
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
}

const ROLE_LABEL = { teacher: 'teacher', student: 'student', parent: 'parent', school_admin: 'admin', accountant: 'accountant', super_admin: 'admin' };

/* every conversation the signed-in user is a member of, shaped for the
   existing MessagesScreen cards: { id, from, role, preview, time, unread } */
export async function listMyConversations(profileId) {
  requireClient();
  const { data: mine, error: e1 } = await supabase.from('conversation_members')
    .select('conversation_id, last_read_at').eq('profile_id', profileId);
  if (e1) throw e1;
  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const lastRead = {};
  (mine || []).forEach((m) => { lastRead[m.conversation_id] = m.last_read_at; });

  const [convRes, memberRes, msgRes] = await Promise.all([
    supabase.from('conversations').select('id, title, school_id, created_at').in('id', ids),
    supabase.from('conversation_members').select('conversation_id, profile_id').in('conversation_id', ids),
    supabase.from('messages').select('conversation_id, sender_id, body, created_at')
      .in('conversation_id', ids).order('created_at', { ascending: false }).limit(400),
  ]);
  if (convRes.error) throw convRes.error;
  if (memberRes.error) throw memberRes.error;
  if (msgRes.error) throw msgRes.error;

  // resolve the OTHER members' names where profiles are readable (staff);
  // otherwise the conversation title / a neutral label is shown instead.
  const otherIds = [...new Set((memberRes.data || [])
    .filter((m) => m.profile_id !== profileId).map((m) => m.profile_id))];
  const names = {};
  if (otherIds.length) {
    const { data: profs } = await supabase.from('profiles')
      .select('id, full_name, role').in('id', otherIds);
    (profs || []).forEach((p) => { names[p.id] = p; });
  }

  return (convRes.data || []).map((conv) => {
    const others = (memberRes.data || [])
      .filter((m) => m.conversation_id === conv.id && m.profile_id !== profileId);
    const other = others.length === 1 ? names[others[0].profile_id] : null;
    const msgs = (msgRes.data || []).filter((m) => m.conversation_id === conv.id);
    const last = msgs[0] || null;
    const read = lastRead[conv.id];
    const unread = msgs.some((m) => m.sender_id !== profileId && (!read || m.created_at > read));
    return {
      id: conv.id,
      from: conv.title || (other && other.full_name) || 'Wada-hadal',
      role: (other && ROLE_LABEL[other.role]) || 'teacher',
      avatar: conv.id,
      preview: last ? last.body : 'Fariin ma jirto weli',
      time: last ? String(last.created_at).slice(11, 16) : '',
      unread,
    };
  }).sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0));
}

/* full thread, shaped for the existing bubbles: { me, text, time } */
export async function listConversationMessages(conversationId, profileId) {
  requireClient();
  const { data, error } = await supabase.from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data || []).map((m) => ({
    me: m.sender_id === profileId,
    text: m.body,
    time: String(m.created_at).slice(11, 16),
  }));
}

export async function sendConversationMessage(conversationId, schoolId, profileId, body) {
  requireClient();
  const text = String(body || '').trim();
  if (!text) throw new Error('Fariin madhan lama diri karo.');
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId, school_id: schoolId, sender_id: profileId, body: text,
  }).select('id, created_at').single();
  if (error) throw error;
  return data;
}

/* unread bookkeeping — my own membership row only (RLS enforces this) */
export async function markConversationRead(conversationId, profileId) {
  requireClient();
  const { error } = await supabase.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('profile_id', profileId);
  if (error) throw error;
}
