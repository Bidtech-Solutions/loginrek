import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

export default function Index() {
  // Selalu arahkan ke Halaman Login terlebih dahulu saat membuka aplikasi
  return (
    <View style={styles.container}>
      <Redirect href="/(auth)/login" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#033F39',
  },
});
