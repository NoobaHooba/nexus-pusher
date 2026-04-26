import { useEffect, useMemo, useRef, useState } from 'react';
import { REPO_TYPES } from '../features/upload/components/RepoSelector';
import {
  clearLoginSettings,
  getInitialAppUi,
  getInitialTheme,
  getSettingsStorageScope,
  loadLoginSettings,
  loadScopedRepoNames,
  loadScopedUserUiPrefs,
  saveAppUi,
  saveLoginSettings,
  saveScopedRepoNames,
  saveScopedUserUiPrefs,
  saveTheme,
} from './storage';
import { DEFAULT_RUNTIME_CONFIG, fetchRuntimeConfig } from './runtimeConfig';

export function useAppShellState() {
  const validRepoIds = useMemo(() => REPO_TYPES.map(({ id }) => id), []);
  const initialAppUi = useMemo(() => getInitialAppUi(validRepoIds), [validRepoIds]);

  const [activePage, setActivePage] = useState(initialAppUi.activePage);
  const [activeRepo, setActiveRepo] = useState(initialAppUi.activeRepo);
  const [theme, setTheme] = useState(getInitialTheme);
  const [runtimeConfig, setRuntimeConfig] = useState(DEFAULT_RUNTIME_CONFIG);
  const [settings, setSettings] = useState(() => loadLoginSettings());
  const [repoNames, setRepoNames] = useState(() => loadScopedRepoNames(loadLoginSettings()));
  const [userUiPrefs, setUserUiPrefs] = useState(() => loadScopedUserUiPrefs(loadLoginSettings()));
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const settingsScope = getSettingsStorageScope(settings);
  const skipPersistUserUiPrefs = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dense-ui', userUiPrefs.denseMode === true);
  }, [userUiPrefs.denseMode]);

  useEffect(() => {
    saveAppUi({ activePage, activeRepo });
  }, [activePage, activeRepo]);

  useEffect(() => {
    fetchRuntimeConfig().then(setRuntimeConfig);
  }, []);

  useEffect(() => {
    setRepoNames(loadScopedRepoNames(settings));
  }, [settingsScope]);

  useEffect(() => {
    skipPersistUserUiPrefs.current = true;
    setUserUiPrefs(loadScopedUserUiPrefs(settings));
  }, [settingsScope]);

  useEffect(() => {
    if (skipPersistUserUiPrefs.current) {
      skipPersistUserUiPrefs.current = false;
      return;
    }
    saveScopedUserUiPrefs(userUiPrefs, settings);
  }, [userUiPrefs, settingsScope]);

  useEffect(() => {
    if (runtimeConfig.nexusUrl && !settings.username) setShowSettings(true);
  }, [runtimeConfig.nexusUrl, settings.username]);

  const effectiveSettings = useMemo(
    () => ({ ...runtimeConfig, ...settings }),
    [runtimeConfig, settings]
  );

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  const saveSettings = (nextSettings) => {
    const next = { username: nextSettings.username || '', password: nextSettings.password || '' };
    const nextUserUiPrefs = {
      denseMode: nextSettings.denseMode === true,
    };
    saveScopedUserUiPrefs(nextUserUiPrefs, next);
    setUserUiPrefs(nextUserUiPrefs);
    setSettings(next);
    saveLoginSettings(next);
    setShowSettings(false);
    setShowUserMenu(false);
  };

  const logout = () => {
    const next = { username: '', password: '' };
    setSettings(next);
    clearLoginSettings();
    setShowUserMenu(false);
  };

  const updateRepoName = (type, name) => {
    setRepoNames((current) => {
      const next = { ...current, [type]: name };
      saveScopedRepoNames(next, settings);
      return next;
    });
  };

  return {
    activePage,
    setActivePage,
    activeRepo,
    setActiveRepo,
    theme,
    denseMode: userUiPrefs.denseMode === true,
    toggleTheme,
    runtimeConfig,
    settings,
    effectiveSettings,
    repoNames,
    updateRepoName,
    showSettings,
    setShowSettings,
    showUserMenu,
    setShowUserMenu,
    saveSettings,
    logout,
  };
}
