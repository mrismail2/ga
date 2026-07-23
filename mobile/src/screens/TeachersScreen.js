import React, { useState } from 'react';
import ListScreen from '../components/ListScreen';
import RowCard from '../components/RowCard';
import TeacherProfileModal from '../components/TeacherProfileModal';
import AddTeacherModal from '../components/AddTeacherModal';
import { TEACHERS } from '../data/datasets';

export default function TeachersScreen({ navigation }) {
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [teachers, setTeachers] = useState(TEACHERS);

  const handleDeleteTeacher = (teacher) => {
    setTeachers(teachers.filter((t) => t !== teacher));
  };

  return (
    <>
      <ListScreen
        navigation={navigation}
        title="Macalimiin"
        subtitle={`${teachers.length} macalin`}
        data={teachers}
        onAdd={() => setShowAdd(true)}
        renderItem={({ item }) => (
          <RowCard
            avatarName={item[0]}
            avatarCode={'TCH-' + item[0].replace(/\s/g, '').slice(0, 6).toUpperCase()}
            title={item[0]}
            subtitle={`${item[1]} · Fasal: ${item[2]}`}
            meta={`${item[3]} snd`}
            onPress={() => setSelected(item)}
          />
        )}
      />
      <TeacherProfileModal
        visible={!!selected}
        teacher={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDeleteTeacher}
      />
      <AddTeacherModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={(t) => setTeachers([t, ...teachers])} />
    </>
  );
}
