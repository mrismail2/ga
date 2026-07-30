import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';
import ListScreen from '../components/ListScreen';
import RowCard from '../components/RowCard';
import SimpleFormModal from '../components/SimpleFormModal';
import { NOTICES } from '../data/datasets';

/* Notice board (Ogeysiisyada) — school announcements.
   Admin-only creation; students/teachers see read-only. */
export default function NoticesScreen({ navigation }) {
  const { role } = useRole();
  const [notices, setNotices] = useState(NOTICES);
  const [showAdd, setShowAdd] = useState(false);

  const canCreate = role === 'superadmin' || role === 'schooladmin';

  const addNotice = (v) => setNotices([[v.title || 'Ogeysiis cusub', 'Maamulka', v.body || '', 'Maanta'], ...notices]);

  return (
    <>
      <ListScreen
        navigation={navigation}
        title="Ogeysiisyada"
        subtitle={canCreate ? `${notices.length} ogeysiis` : 'Ogeysiisyada dugsiga'}
        onAdd={canCreate ? () => setShowAdd(true) : undefined}
        data={notices}
        renderItem={({ item }) => (
          <RowCard
            title={item[0]}
            subtitle={`${item[1]} · ${item[2]}`}
            meta={item[3]}
          />
        )}
      />
      {canCreate && (
        <SimpleFormModal
          visible={showAdd}
          title="Ogeysiis Cusub Samee"
          saveLabel="Dir Ogeysiiska"
          fields={[
            { key: 'title', label: 'CINWAANKA', placeholder: 'tusaale: Shirka macalimiinta', required: true },
            { key: 'body', label: 'QORAALKA', placeholder: 'Qor ogeysiiska…', multiline: true },
          ]}
          onClose={() => setShowAdd(false)}
          onSubmit={addNotice}
        />
      )}
    </>
  );
}
