/* ============================================================
   Kobciye — canonical messaging (Fariimaha, Live Mode)

   Reads/writes the canonical conversations / conversation_members /
   messages tables under the caller's own JWT. Every Live Mode operation is
   scoped to one validated school UUID:
     • School Admin / Teacher / Student -> their own school
     • Super Admin -> the school selected in "Dooro Dugsi"

   RLS and database guards remain the final authority. No service-role key,
   demo conversation fallback, attachment simulation, SMS or WhatsApp.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';
import { isUuid } from '../utils/uuid';

function requireClient() {
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
}

function requireUuid(value, label) {
  if (!isUuid(value)) {
    const e = new Error(`${label} sax ah ayaa loo baahan yahay.`);
    e.code = label === 'Dugsi' ? 'invalid_school_id' : 'invalid_uuid';
    throw e;
  }
  return value.trim();
}

function requireSchoolUuid(schoolId) {
  return requireUuid(schoolId, 'Dugsi');
}

async function assertConversationInSchool(conversationId, schoolId) {
  const conversation = requireUuid(conversationId, 'Wada-hadal');
  const school = requireSchoolUuid(schoolId);
  const { data, error } = await supabase.from('conversations')
    .select('id')
    .eq('id', conversation)
    .eq('school_id', school)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const e = new Error('Wada-hadalku kama tirsana dugsiga hadda la doortay ama ma lihid oggolaansho.');
    e.code = 'conversation_school_mismatch';
    throw e;
  }
  return conversation;
}

const ROLE_LABEL = { teacher: 'teacher', student: 'student', parent: 'parent', school_admin: 'admin', accountant: 'accountant', super_admin: 'admin' };

/* Every conversation the signed-in user is a member of, restricted again to
   the currently active school. The second school filter prevents a stale
   School A membership/result from remaining visible after switching to B. */
export async function listMyConversations(profileId, schoolId) {
  requireClient();
  const profile = requireUuid(profileId, 'Profile');
  const school = requireSchoolUuid(schoolId);

  const { data: mine, error: e1 } = await supabase.from('conversation_members')
    .select('conversation_id, last_read_at').eq('profile_id', profile);
  if (e1) throw e1;
  const membershipIds = (mine || []).map((m) => m.conversation_id).filter(isUuid);
  if (!membershipIds.length) return [];

  const { data: conversations, error: convError } = await supabase.from('conversations')
    .select('id, title, school_id, created_at')
    .in('id', membershipIds)
    .eq('school_id', school);
  if (convError) throw convError;
  const allowedIds = (conversations || []).map((c) => c.id);
  if (!allowedIds.length) return [];

  const lastRead = {};
  (mine || []).forEach((m) => {
    if (allowedIds.includes(m.conversation_id)) lastRead[m.conversation_id] = m.last_read_at;
  });

  const [memberRes, msgRes] = await Promise.all([
    supabase.from('conversation_members').select('conversation_id, profile_id').in('conversation_id', allowedIds),
    supabase.from('messages').select('conversation_id, sender_id, body, created_at')
      .in('conversation_id', allowedIds).eq('school_id', school)
      .order('created_at', { ascending: false }).limit(400),
  ]);
  if (memberRes.error) throw memberRes.error;
  if (msgRes.error) throw msgRes.error;

  const otherIds = [...new Set((memberRes.data || [])
    .filter((m) => m.profile_id !== profile).map((m) => m.profile_id))];
  const names = {};
  if (otherIds.length) {
    const { data: profs } = await supabase.from('profiles')
      .select('id, full_name, role').in('id', otherIds).eq('school_id', school);
    (profs || []).forEach((p) => { names[p.id] = p; });
  }

  return (conversations || []).map((conv) => {
    const others = (memberRes.data || [])
      .filter((m) => m.conversation_id === conv.id && m.profile_id !== profile);
    const other = others.length === 1 ? names[others[0].profile_id] : null;
    const msgs = (msgRes.data || []).filter((m) => m.conversation_id === conv.id);
    const last = msgs[0] || null;
    const read = lastRead[conv.id];
    const unread = msgs.some((m) => m.sender_id !== profile && (!read || m.created_at > read));
    return {
      id: conv.id,
      from: conv.title || (other && other.full_name) || 'Wada-hadal',
      role: (other && ROLE_LABEL[other.role]) || 'teacher',
      avatar: conv.id,
      preview: last ? last.body : 'Fariin ma jirto weli',
      time: last ? String(last.created_at).slice(11, 16) : '',
      unread,
      school_id: conv.school_id,
    };
  }).sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0));
}

export async function listConversationMessages(conversationId, profileId, schoolId) {
  requireClient();
  const profile = requireUuid(profileId, 'Profile');
  const school = requireSchoolUuid(schoolId);
  const conversation = await assertConversationInSchool(conversationId, school);
  const { data, error } = await supabase.from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversation)
    .eq('school_id', school)
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data || []).map((m) => ({
    me: m.sender_id === profile,
    text: m.body,
    time: String(m.created_at).slice(11, 16),
  }));
}

export async function sendConversationMessage(conversationId, schoolId, profileId, body) {
  requireClient();
  const school = requireSchoolUuid(schoolId);
  const profile = requireUuid(profileId, 'Profile');
  const conversation = await assertConversationInSchool(conversationId, school);
  const text = String(body || '').trim();
  if (!text) throw new Error('Fariin madhan lama diri karo.');
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversation, school_id: school, sender_id: profile, body: text,
  }).select('id, created_at').single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId, profileId, schoolId) {
  requireClient();
  const profile = requireUuid(profileId, 'Profile');
  const conversation = await assertConversationInSchool(conversationId, schoolId);
  const { error } = await supabase.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversation).eq('profile_id', profile);
  if (error) throw error;
}
