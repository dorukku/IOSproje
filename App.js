import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Image // <-- burada olsun!
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { db, storage } from "./firebase";
import {
  collection,
  setDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";


const Stack = createNativeStackNavigator();

const PRIMARY = "#26577C";
const ACCENT = "#EBE4D1";
const GREEN = "#00C897";

function normalizeName(name) {
  return name
    ? name
        .trim()
        .toLowerCase()
        .replaceAll(" ", "")
        .replaceAll("ı", "i")
        .replaceAll("ş", "s")
        .replaceAll("ğ", "g")
        .replaceAll("ü", "u")
        .replaceAll("ö", "o")
        .replaceAll("ç", "c")
    : "";
}

function ModernButton({ title, onPress, color, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          backgroundColor: color || PRIMARY,
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 12,
          alignItems: "center",
          marginVertical: 6,
        },
        style,
      ]}
      activeOpacity={0.88}
    >
      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// ----- Giriş Ekranı -----
function LoginScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (username.trim().length === 0) {
      alert("Lütfen bir kullanıcı adı gir!");
      return;
    }
    setLoading(true);
    await setDoc(
      doc(db, "users", normalizeName(username)),
      {
        name: username,
      },
      { merge: true }
    );
    await AsyncStorage.setItem("username", normalizeName(username));
    setLoading(false);
    navigation.replace("Chats");
  };

  useEffect(() => {
    AsyncStorage.getItem("username").then((name) => {
      if (name) navigation.replace("Chats");
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Chat App</Text>
      <TextInput
        style={styles.input}
        placeholder="Kullanıcı adınızı girin"
        value={username}
        onChangeText={setUsername}
      />
      <ModernButton title="Giriş Yap" onPress={handleLogin} />
      {loading && <ActivityIndicator size="small" color={PRIMARY} />}
    </SafeAreaView>
  );
}

// ----- Kişiler Ekranı -----
function UsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [myName, setMyName] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const arr = [];
      snap.forEach((doc) => {
        arr.push({ ...doc.data(), id: doc.id });
      });
      setUsers(arr);
    };
    fetchUsers();
    AsyncStorage.getItem("username").then(setMyName);
  }, []);

  const startChat = async (otherUser) => {
    const normalizedMy = normalizeName(myName);
    const normalizedOther = normalizeName(otherUser.id);

    const chatID =
      normalizedMy < normalizedOther
        ? `${normalizedMy}_${normalizedOther}`
        : `${normalizedOther}_${normalizedMy}`;

    const chatDocRef = doc(db, "chats", chatID);
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      await setDoc(chatDocRef, {
        users: [normalizedMy, normalizedOther],
        lastMessage: "",
        lastTimestamp: serverTimestamp(),
      });
    }

    navigation.navigate("ChatRoom", {
      chatID,
      otherUser: otherUser.name,
      myName,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Kişiler</Text>
      <FlatList
        data={users.filter(
          (user) => normalizeName(user.name) !== normalizeName(myName)
        )}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => startChat(item)}
            style={styles.listItem}
          >
            <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: "#888" }}>
            Başka kullanıcı yok
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ----- Sohbetler Ekranı -----
function ChatsScreen({ navigation }) {
  const [myName, setMyName] = useState("");
  const [chats, setChats] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem("username").then((username) => {
      setMyName(username);
      if (!username) navigation.replace("Login");
      const normalizedMy = normalizeName(username);

      const q1 = query(collection(db, "chats"), orderBy("lastTimestamp", "desc"));
      const unsub = onSnapshot(q1, (snapshot) => {
        const arr = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.users.includes(normalizedMy) && data.lastMessage) {
            arr.push({ id: doc.id, ...data });
          }
        });
        setChats(arr);
      });
      return () => unsub();
    });
  }, []);

  const getOtherName = (users) => {
    const normalizedMy = normalizeName(myName);
    return users.find((u) => u !== normalizedMy);
  };

  const goToChat = async (chat) => {
    const usersCol = collection(db, "users");
    const otherID = getOtherName(chat.users);
    const otherDoc = await getDoc(doc(usersCol, otherID));
    const otherName = otherDoc.exists() ? otherDoc.data().name : otherID;
    navigation.navigate("ChatRoom", {
      chatID: chat.id,
      otherUser: otherName,
      myName,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Sohbetler</Text>
      <ModernButton
        title="Profil"
        onPress={() => navigation.navigate("Profile")}
        color={ACCENT}
      />
      <ModernButton
        title="Kişiler"
        onPress={() => navigation.navigate("Users")}
        color={GREEN}
      />
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => goToChat(item)}
            style={styles.listItem}
          >
            <Text style={{ fontWeight: "bold" }}>
              {item.users
                .map((u) =>
                  normalizeName(u) !== normalizeName(myName) ? u : null
                )
                .filter(Boolean)
                .join(", ")}
            </Text>
            <Text numberOfLines={1} style={{ color: "#666" }}>
              {item.lastMessage}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: "#888" }}>
            Henüz hiç sohbet yok
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ----- Sohbet Odası -----
function ChatRoomScreen({ route, navigation }) {
  const { chatID, otherUser, myName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: otherUser });
    const messagesCol = collection(db, "chats", chatID, "messages");
    const q1 = query(messagesCol, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q1, (snapshot) => {
      const arr = [];
      snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setMessages(arr);
    });
    return () => unsub();
  }, [chatID, otherUser]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    const msg = {
      text: text.trim(),
      sender: normalizeName(myName),
      timestamp: serverTimestamp(),
    };
    const messagesCol = collection(db, "chats", chatID, "messages");
    await addDoc(messagesCol, msg);
    await updateDoc(doc(db, "chats", chatID), {
      lastMessage: msg.text,
      lastTimestamp: serverTimestamp(),
    });
    setText("");
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.sender === normalizeName(myName)
                ? styles.myBubble
                : styles.otherBubble,
            ]}
          >
            <Text
              style={{
                color: item.sender === normalizeName(myName) ? "#fff" : "#222",
              }}
            >
              {item.text}
            </Text>
          </View>
        )}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          value={text}
          onChangeText={setText}
          placeholder="Mesaj yaz..."
        />
        <ModernButton
          title={sending ? "..." : "Gönder"}
          onPress={sendMessage}
          color={PRIMARY}
          style={{ paddingHorizontal: 16 }}
        />
      </View>
    </SafeAreaView>
  );
}

// ----- Kullanıcı Profil Ekranı -----
function ProfileScreen({ navigation }) {
  const [myName, setMyName] = useState("");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("username").then(async (username) => {
      setMyName(username);
      setNewName(username);

      // Kullanıcı profilini çek
      const userDoc = await getDoc(doc(db, "users", username));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.status) {
          setStatus(data.status);
          setNewStatus(data.status);
        }
        if (data.photoURL) {
          setProfilePhoto(data.photoURL);
        }
      }
    });
  }, []);

  const handleChangeName = async () => {
    if (!newName.trim()) return;
    await setDoc(
      doc(db, "users", normalizeName(newName)),
      { name: newName, status, photoURL: profilePhoto },
      { merge: true }
    );
    await AsyncStorage.setItem("username", normalizeName(newName));
    setMyName(normalizeName(newName));
    alert("Kullanıcı adın güncellendi!");
  };

  const handleStatusSave = async () => {
    await updateDoc(doc(db, "users", myName), { status: newStatus });
    setStatus(newStatus);
    alert("Durumun güncellendi!");
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("username");
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      alert("Fotoğraf seçmek için izin ver!");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.cancelled && result.assets && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const imageRef = ref(storage, `profiles/${myName}_${Date.now()}.jpg`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      setProfilePhoto(downloadURL);
      await updateDoc(doc(db, "users", myName), { photoURL: downloadURL });
      alert("Profil fotoğrafı güncellendi!");
    } catch (e) {
      alert("Fotoğraf yüklenemedi.");
    }
    setUploading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Profil</Text>
      <TouchableOpacity onPress={pickImage}>
        <View style={{
          alignSelf: "center",
          borderWidth: 2,
          borderColor: ACCENT,
          borderRadius: 64,
          width: 128,
          height: 128,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 10,
          overflow: "hidden"
        }}>
          {profilePhoto ? (
            <Image
              source={{ uri: profilePhoto }}
              style={{ width: 124, height: 124, borderRadius: 62 }}
            />
          ) : (
            <Text style={{ fontSize: 32, color: "#ccc" }}>+</Text>
          )}
        </View>
      </TouchableOpacity>
      <Text style={{ textAlign: "center", color: "#666", marginBottom: 8 }}>
        Profil fotoğrafına tıkla, değiştir.
      </Text>
      <Text style={{ fontSize: 16, marginBottom: 8 }}>
        Kullanıcı adın: <Text style={{ fontWeight: "bold" }}>{myName}</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={newName}
        onChangeText={setNewName}
        placeholder="Yeni kullanıcı adı"
      />
      <ModernButton title="Adı Güncelle" onPress={handleChangeName} />
      <Text style={{ fontWeight: "bold", marginTop: 16 }}>Durumun</Text>
      <TextInput
        style={styles.input}
        value={newStatus}
        onChangeText={setNewStatus}
        placeholder="Durumun (ör: Müsait, Meşgul...)"
      />
      <ModernButton title="Durumu Kaydet" onPress={handleStatusSave} />
      <ModernButton title="Çıkış Yap" onPress={handleLogout} color="#ff6666" />
      {uploading && <ActivityIndicator color={PRIMARY} style={{ marginTop: 10 }} />}
    </SafeAreaView>
  );
}

// ----- Navigation -----
export default function App() {
  return (
    <NavigationContainer theme={DefaultTheme}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Chats" component={ChatsScreen} />
        <Stack.Screen name="Users" component={UsersScreen} />
        <Stack.Screen
          name="ChatRoom"
          component={ChatRoomScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: ACCENT },
          }}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 36,
    paddingHorizontal: 18,
  },
  header: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
    color: PRIMARY,
  },
  input: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    backgroundColor: "#f5f5f5",
    fontSize: 16,
  },
  listItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    marginVertical: 4,
  },
  messageBubble: {
    padding: 10,
    marginVertical: 2,
    marginHorizontal: 8,
    borderRadius: 10,
    maxWidth: "70%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: PRIMARY,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#eee",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
});

