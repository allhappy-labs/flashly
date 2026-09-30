import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useTranslation } from "react-i18next";

import AccountScreen from "../screens/AccountScreen";
import AboutScreen from "../screens/AboutScreen";
import AuthScreen from "../screens/AuthScreen";
import BrowseScreen from "../screens/BrowseScreen";
import CardEditScreen from "../screens/CardEditScreen";
import DailyGoalScreen from "../screens/DailyGoalScreen";
import DeckAnalyticsScreen from "../screens/DeckAnalyticsScreen";
import DeckCreateScreen from "../screens/DeckCreateScreen";
import DeckDetailScreen from "../screens/DeckDetailScreen";
import DeckListScreen from "../screens/DeckListScreen";
import DeckOverviewScreen from "../screens/DeckOverviewScreen";
import ExportScreen from "../screens/ExportScreen";
import FsrsSettingsScreen from "../screens/FsrsSettingsScreen";
import HelpScreen from "../screens/HelpScreen";
import ImportScreen from "../screens/ImportScreen";
import { HostedIntroCarouselScreen } from "../screens/IntroCarouselScreen";
import LanguageScreen from "../screens/LanguageScreen";
import LearnModeScreen from "../screens/LearnModeScreen";
import LearnSetupScreen from "../screens/LearnSetupScreen";
import MarketplaceDetailScreen from "../screens/MarketplaceDetailScreen";
import MarketplaceScreen from "../screens/MarketplaceScreen";
import MatchModeScreen from "../screens/MatchModeScreen";
import SettingsScreen from "../screens/SettingsScreen";
import StudyScreen from "../screens/StudyScreen";
import TestModeScreen from "../screens/TestModeScreen";
import TimeGradingSettingsScreen from "../screens/TimeGradingSettingsScreen";
import WriteModeScreen from "../screens/WriteModeScreen";
import type { AppTabParamList, HostedDeckStackParamList } from "./types";
import { authClient } from "../services/auth/auth-client";
import { usePalette } from "../theme";
import { useStore } from "../store/useStore";

const AuthStack = createNativeStackNavigator<HostedDeckStackParamList>();
const DecksStack = createNativeStackNavigator<HostedDeckStackParamList>();
const BrowseStack = createNativeStackNavigator<HostedDeckStackParamList>();
const AccountStack = createNativeStackNavigator<HostedDeckStackParamList>();
const SettingsStack = createNativeStackNavigator<HostedDeckStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();

function getBooleanProperty(value: unknown, key: string): boolean | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const property = Reflect.get(value, key);
  return typeof property === "boolean" ? property : undefined;
}

function DecksStackNavigator() {
  const { t } = useTranslation();

  return (
    <DecksStack.Navigator>
      <DecksStack.Screen
        name="DeckList"
        component={DeckListScreen}
        options={{ headerShown: false }}
      />
      <DecksStack.Screen name="DeckOverview" component={DeckOverviewScreen} options={{ title: "" }} />
      <DecksStack.Screen name="DeckAnalytics" component={DeckAnalyticsScreen} options={{ title: "" }} />
      <DecksStack.Screen name="DeckDetail" component={DeckDetailScreen} options={{ title: "" }} />
      <DecksStack.Screen name="DeckCreate" component={DeckCreateScreen} options={{ title: t("deck.title") }} />
      <DecksStack.Screen name="CardEdit" component={CardEditScreen} options={{ title: "" }} />
      <DecksStack.Screen name="Study" component={StudyScreen} options={{ title: t("study.title") }} />
      <DecksStack.Screen name="Browse" component={BrowseScreen} options={{ title: t("browse.title") }} />
      <DecksStack.Screen name="Match" component={MatchModeScreen} options={{ title: t("match.title") }} />
      <DecksStack.Screen name="Write" component={WriteModeScreen} options={{ title: t("write.title") }} />
      <DecksStack.Screen name="Test" component={TestModeScreen} options={{ title: t("test.title") }} />
      <DecksStack.Screen name="LearnSetup" component={LearnSetupScreen} options={{ title: t("learn.title") }} />
      <DecksStack.Screen name="Learn" component={LearnModeScreen} options={{ title: t("learn.title") }} />
      <DecksStack.Screen name="Import" component={ImportScreen} options={{ title: t("import.title") }} />
      <DecksStack.Screen name="Export" component={ExportScreen} options={{ title: t("export.title") }} />
      <DecksStack.Screen name="Language" component={LanguageScreen} />
      <DecksStack.Screen name="FsrsSettings" component={FsrsSettingsScreen} />
      <DecksStack.Screen name="TimeGradingSettings" component={TimeGradingSettingsScreen} />
      <DecksStack.Screen name="DailyGoal" component={DailyGoalScreen} options={{ title: t("dailyGoal.title") }} />
      <DecksStack.Screen name="Help" component={HelpScreen} options={{ title: t("help.title") }} />
      <DecksStack.Screen name="About" component={AboutScreen} options={{ title: t("about.title") }} />
    </DecksStack.Navigator>
  );
}

function BrowseStackNavigator() {
  return (
    <BrowseStack.Navigator>
      <BrowseStack.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ headerShown: false }}
      />
      <BrowseStack.Screen
        name="MarketplaceDetail"
        component={MarketplaceDetailScreen}
        options={{ headerShown: false }}
      />
    </BrowseStack.Navigator>
  );
}

function AccountStackNavigator() {
  const { t } = useTranslation();

  return (
    <AccountStack.Navigator>
      <AccountStack.Screen
        name="AccountHome"
        component={AccountScreen}
        options={{ title: t("account.title"), headerShown: false }}
      />
      <AccountStack.Screen name="Export" component={ExportScreen} options={{ title: t("export.title") }} />
    </AccountStack.Navigator>
  );
}

function SettingsStackNavigator() {
  const { t } = useTranslation();

  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen name="Language" component={LanguageScreen} />
      <SettingsStack.Screen name="FsrsSettings" component={FsrsSettingsScreen} />
      <SettingsStack.Screen name="TimeGradingSettings" component={TimeGradingSettingsScreen} />
      <SettingsStack.Screen name="DailyGoal" component={DailyGoalScreen} options={{ title: t("dailyGoal.title") }} />
      <SettingsStack.Screen name="Help" component={HelpScreen} options={{ title: t("help.title") }} />
      <SettingsStack.Screen name="About" component={AboutScreen} options={{ title: t("about.title") }} />
    </SettingsStack.Navigator>
  );
}

function HostedTabs() {
  const { t } = useTranslation();
  const palette = usePalette();

  return (
    <AppTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "BrowseTab") {
            return <Ionicons name="search-outline" size={size} color={color} />;
          }
          if (route.name === "DecksTab") {
            return <Ionicons name="albums-outline" size={size} color={color} />;
          }
          if (route.name === "AccountTab") {
            return <Ionicons name="person-circle-outline" size={size} color={color} />;
          }
          return <Ionicons name="settings-outline" size={size} color={color} />;
        },
      })}
    >
      <AppTabs.Screen name="BrowseTab" component={BrowseStackNavigator} options={{ title: t("deck.browse") }} />
      <AppTabs.Screen name="DecksTab" component={DecksStackNavigator} options={{ title: t("deckList.title") }} />
      <AppTabs.Screen name="AccountTab" component={AccountStackNavigator} options={{ title: t("account.title") }} />
      <AppTabs.Screen name="SettingsTab" component={SettingsStackNavigator} options={{ title: t("settings.title") }} />
    </AppTabs.Navigator>
  );
}

export default function AppNavigator() {
  const sessionQuery = authClient.useSession();
  const sessionData = sessionQuery.data ?? null;
  const isAuthenticated = Boolean(sessionData?.user);
  const introSeen = useStore((state) => state.introSeen);
  const setIntroSeen = useStore((state) => state.setIntroSeen);
  const authPending =
    getBooleanProperty(sessionQuery, "isPending") ??
    getBooleanProperty(sessionQuery, "isLoading") ??
    false;
  const lastAuthState = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (authPending) return;
    if (lastAuthState.current === null) {
      lastAuthState.current = isAuthenticated;
      return;
    }
    if (lastAuthState.current && !isAuthenticated) {
      void setIntroSeen(false);
    }
    lastAuthState.current = isAuthenticated;
  }, [authPending, isAuthenticated, setIntroSeen]);

  if (authPending) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator
        initialRouteName={introSeen ? "Auth" : "Intro"}
        screenOptions={{ headerShown: false }}
      >
        <AuthStack.Screen name="Intro" component={HostedIntroCarouselScreen} />
        <AuthStack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      </AuthStack.Navigator>
    );
  }

  return <HostedTabs />;
}
