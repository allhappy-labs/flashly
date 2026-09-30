import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AboutScreen from '../screens/AboutScreen';
import BrowseScreen from '../screens/BrowseScreen';
import CardEditScreen from '../screens/CardEditScreen';
import DailyGoalScreen from '../screens/DailyGoalScreen';
import DeckAnalyticsScreen from '../screens/DeckAnalyticsScreen';
import DeckCreateScreen from '../screens/DeckCreateScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckOverviewScreen from '../screens/DeckOverviewScreen';
import ExportScreen from '../screens/ExportScreen';
import FsrsSettingsScreen from '../screens/FsrsSettingsScreen';
import ImportScreen from '../screens/ImportScreen';
import IntroCarouselScreen from '../screens/IntroCarouselScreen';
import LanguageScreen from '../screens/LanguageScreen';
import LearnModeScreen from '../screens/LearnModeScreen';
import LearnSetupScreen from '../screens/LearnSetupScreen';
import MatchModeScreen from '../screens/MatchModeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StudyScreen from '../screens/StudyScreen';
import TestModeScreen from '../screens/TestModeScreen';
import TimeGradingSettingsScreen from '../screens/TimeGradingSettingsScreen';
import WriteModeScreen from '../screens/WriteModeScreen';
import { useStore } from '../store/useStore';
import { usePalette } from '../theme';
import { LOCAL_TAB_NAMES } from './local-navigation-config';
import type {
  LocalDeckStackParamList,
  LocalRootStackParamList,
  LocalSettingsStackParamList,
  LocalTabParamList,
} from './types';

const LocalRootStack = createNativeStackNavigator<LocalRootStackParamList>();
const LocalDecksStack = createNativeStackNavigator<LocalDeckStackParamList>();
const LocalSettingsStack = createNativeStackNavigator<LocalSettingsStackParamList>();
const LocalTabs = createBottomTabNavigator<LocalTabParamList>();

function LocalDecksStackNavigator() {
  const { t } = useTranslation();

  return (
    <LocalDecksStack.Navigator>
      <LocalDecksStack.Screen name="DeckList" component={DeckListScreen} options={{ headerShown: false }} />
      <LocalDecksStack.Screen name="DeckOverview" component={DeckOverviewScreen} options={{ title: '' }} />
      <LocalDecksStack.Screen name="DeckAnalytics" component={DeckAnalyticsScreen} options={{ title: '' }} />
      <LocalDecksStack.Screen name="DeckDetail" component={DeckDetailScreen} options={{ title: '' }} />
      <LocalDecksStack.Screen name="DeckCreate" component={DeckCreateScreen} options={{ title: t('deck.title') }} />
      <LocalDecksStack.Screen name="CardEdit" component={CardEditScreen} options={{ title: '' }} />
      <LocalDecksStack.Screen name="Study" component={StudyScreen} options={{ title: t('study.title') }} />
      <LocalDecksStack.Screen name="Browse" component={BrowseScreen} options={{ title: t('browse.title') }} />
      <LocalDecksStack.Screen name="Match" component={MatchModeScreen} options={{ title: t('match.title') }} />
      <LocalDecksStack.Screen name="Write" component={WriteModeScreen} options={{ title: t('write.title') }} />
      <LocalDecksStack.Screen name="Test" component={TestModeScreen} options={{ title: t('test.title') }} />
      <LocalDecksStack.Screen name="LearnSetup" component={LearnSetupScreen} options={{ title: t('learn.title') }} />
      <LocalDecksStack.Screen name="Learn" component={LearnModeScreen} options={{ title: t('learn.title') }} />
      <LocalDecksStack.Screen name="Import" component={ImportScreen} options={{ title: t('import.title') }} />
      <LocalDecksStack.Screen name="Export" component={ExportScreen} options={{ title: t('export.title') }} />
      <LocalDecksStack.Screen name="Language" component={LanguageScreen} />
      <LocalDecksStack.Screen name="FsrsSettings" component={FsrsSettingsScreen} />
      <LocalDecksStack.Screen name="TimeGradingSettings" component={TimeGradingSettingsScreen} />
      <LocalDecksStack.Screen name="DailyGoal" component={DailyGoalScreen} options={{ title: t('dailyGoal.title') }} />
      <LocalDecksStack.Screen name="About" component={AboutScreen} options={{ title: t('about.title') }} />
    </LocalDecksStack.Navigator>
  );
}

function LocalSettingsStackNavigator() {
  const { t } = useTranslation();

  return (
    <LocalSettingsStack.Navigator>
      <LocalSettingsStack.Screen name="SettingsHome" component={SettingsScreen} options={{ headerShown: false }} />
      <LocalSettingsStack.Screen name="Language" component={LanguageScreen} />
      <LocalSettingsStack.Screen name="FsrsSettings" component={FsrsSettingsScreen} />
      <LocalSettingsStack.Screen name="TimeGradingSettings" component={TimeGradingSettingsScreen} />
      <LocalSettingsStack.Screen name="DailyGoal" component={DailyGoalScreen} options={{ title: t('dailyGoal.title') }} />
      <LocalSettingsStack.Screen name="About" component={AboutScreen} options={{ title: t('about.title') }} />
    </LocalSettingsStack.Navigator>
  );
}

const LOCAL_TAB_COMPONENTS: Record<keyof LocalTabParamList, React.ComponentType> = {
  DecksTab: LocalDecksStackNavigator,
  SettingsTab: LocalSettingsStackNavigator,
};

function LocalTabsNavigator() {
  const { t } = useTranslation();
  const palette = usePalette();
  const localTabTitles: Record<keyof LocalTabParamList, string> = {
    DecksTab: t('deckList.title'),
    SettingsTab: t('settings.title'),
  };

  return (
    <LocalTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={route.name === 'DecksTab' ? 'albums-outline' : 'settings-outline'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {LOCAL_TAB_NAMES.map((tabName) => (
        <LocalTabs.Screen
          key={tabName}
          name={tabName}
          component={LOCAL_TAB_COMPONENTS[tabName]}
          options={{ title: localTabTitles[tabName] }}
        />
      ))}
    </LocalTabs.Navigator>
  );
}

export default function LocalAppNavigator() {
  const introSeen = useStore((state) => state.introSeen);

  return (
    <LocalRootStack.Navigator initialRouteName={introSeen ? 'LocalTabs' : 'Intro'} screenOptions={{ headerShown: false }}>
      <LocalRootStack.Screen name="Intro" component={IntroCarouselScreen} />
      <LocalRootStack.Screen name="LocalTabs" component={LocalTabsNavigator} />
    </LocalRootStack.Navigator>
  );
}
