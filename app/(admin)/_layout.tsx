import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function AdminLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    backgroundColor: '#F8FAFC',
                },
            }}
        >
            <Stack.Screen
                name="attendance-log"
                options={{
                    headerTitle: 'Attendance Log',
                }}
            />
            <Stack.Screen
                name="students"
                options={{
                    headerTitle: 'Students',
                }}
            />
            <Stack.Screen
                name="departments"
                options={{
                    headerTitle: 'Departments',
                }}
            />
            <Stack.Screen
                name="courses"
                options={{
                    headerTitle: 'Courses',
                }}
            />
            <Stack.Screen
                name="levels"
                options={{
                    headerTitle: 'Levels',
                }}
            />
            <Stack.Screen name="forms/department" />
            <Stack.Screen name="forms/course" />
            <Stack.Screen name="forms/level" />
            <Stack.Screen name="settings" />
        </Stack>
    );
}
