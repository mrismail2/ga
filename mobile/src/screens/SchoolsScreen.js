import React, { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import ListScreen from '../components/ListScreen';
import RowCard from '../components/RowCard';
import SimpleFormModal from '../components/SimpleFormModal';
import { SCHOOLS } from '../data/mock';

const STATUS = {
  active: { tone: 'green', label: 'Firfircoon' },
  trial: { tone: 'gold', label: 'Tijaabo' },
  suspended: { tone: 'rose', label: 'La hakiyay' },
};

/* Super-Admin platform view: every school + an Add School form. */
export default function SchoolsScreen({ navigation }) {
  const { c } = useTheme();
  const [schools, setSchools] = useState(SCHOOLS);
  const [showAdd, setShowAdd] = useState(false);

  const addSchool = (v) => {
    const n = schools.length + 45;
    setSchools([{
      id: (v.name || 'school').toLowerCase().replace(/\s/g, ''),
      code: 'KOB-SCH-00' + n,
      name: v.name || 'Dugsi Cusub',
      type: v.type || 'Primary School',
      city: v.city || 'Magaalada',
      principal: v.principal || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      founded: v.founded || '',
      capacity: parseInt(v.capacity, 10) || 0,
      students: 0,
      status: 'trial',
    }, ...schools]);
  };

  return (
    <>
      <ListScreen
        navigation={navigation}
        title="Dugsiyada"
        subtitle={`${schools.length} dugsi`}
        onAdd={() => setShowAdd(true)}
        stats={[
          { label: 'Dugsiyada', value: String(schools.length), tone: 'navy', icon: 'building' },
          { label: 'Firfircoon', value: String(schools.filter((s) => s.status === 'active').length), tone: 'green', icon: 'building' },
        ]}
        data={schools}
        renderItem={({ item }) => {
          const st = STATUS[item.status] || STATUS.active;
          return (
            <RowCard
              avatarName={item.name.replace(/^Dugsiga\s+/i, '')}
              avatarCode={item.id}
              title={item.name}
              verified={item.status === 'active'}
              subtitle={`${item.type} · ${item.city} · ${item.students} arday`}
              badge={{ label: st.label, tone: st.tone }}
            />
          );
        }}
      />
      <SimpleFormModal
        visible={showAdd}
        title="Dugsi Cusub Ku Dar"
        saveLabel="Kaydi Dugsiga"
        fields={[
          { key: 'name', label: 'MAGACA DUGSIGA', placeholder: 'tusaale: Dugsiga Horseed', required: true },
          { key: 'type', label: 'NOOCA', options: ['Primary School', 'Secondary School', 'Mixed'] },
          { key: 'principal', label: 'MAAMULAHA DUGSIGA', placeholder: 'Magaca maamulaha' },
          { key: 'phone', label: 'TALEEFOON', placeholder: '+252 …' },
          { key: 'email', label: 'EMAIL', placeholder: 'tusaale: info@dugsi.edu' },
          { key: 'city', label: 'MAGAALADA', placeholder: 'tusaale: Hargeysa' },
          { key: 'address', label: 'CINWAANKA', placeholder: 'Xaafadda / degmada' },
          { key: 'founded', label: 'SANNADKA LA AASAASAY', placeholder: 'tusaale: 2015' },
          { key: 'capacity', label: 'QADKA ARDAYDA (CAPACITY)', placeholder: 'tusaale: 500' },
        ]}
        onClose={() => setShowAdd(false)}
        onSubmit={addSchool}
      />
    </>
  );
}
