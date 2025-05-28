
"use client";

import type { ContentItem, ChatMessage } from '@/lib/types';
import React, { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect } from 'react';

interface AppState {
  contentItems: ContentItem[];
  selectedContentId: string | null;
  chatMessages: ChatMessage[];
  isSummaryLoading: Record<string, boolean>; // To track loading state for individual content item summaries
  isChatLoading: boolean;
}

type AppAction =
  | { type: 'ADD_CONTENT'; payload: ContentItem }
  | { type: 'SELECT_CONTENT'; payload: string | null }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'SET_SUMMARY_LOADING'; payload: { id: string; isLoading: boolean } }
  | { type: 'UPDATE_CONTENT_SUMMARY'; payload: { id: string; summary: string } }
  | { type: 'DELETE_CONTENT'; payload: string }
  | { type: 'HYDRATE_STATE'; payload: Partial<AppState> }; // Added HYDRATE_STATE action

const LOCAL_STORAGE_CONTENT_ITEMS_KEY = 'remiAppContentItems';
const LOCAL_STORAGE_CHAT_MESSAGES_KEY = 'remiAppChatMessages';
const LOCAL_STORAGE_SELECTED_CONTENT_ID_KEY = 'remiAppSelectedContentId';

const defaultInitialState: AppState = {
  contentItems: [],
  selectedContentId: null,
  chatMessages: [],
  isSummaryLoading: {},
  isChatLoading: false,
};

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> } | undefined>(undefined);

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_CONTENT':
      return {
        ...state,
        contentItems: [action.payload, ...state.contentItems],
      };
    case 'SELECT_CONTENT':
      return {
        ...state,
        selectedContentId: action.payload,
      };
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload],
      };
    case 'SET_CHAT_LOADING':
      return {
        ...state,
        isChatLoading: action.payload,
      };
    case 'SET_SUMMARY_LOADING':
      return {
        ...state,
        isSummaryLoading: {
          ...state.isSummaryLoading,
          [action.payload.id]: action.payload.isLoading,
        },
      };
    case 'UPDATE_CONTENT_SUMMARY':
      return {
        ...state,
        contentItems: state.contentItems.map(item =>
          item.id === action.payload.id ? { ...item, summary: action.payload.summary } : item
        ),
        isSummaryLoading: {
          ...state.isSummaryLoading,
          [action.payload.id]: false,
        },
      };
    case 'DELETE_CONTENT':
      return {
        ...state,
        contentItems: state.contentItems.filter(item => item.id !== action.payload),
        selectedContentId: state.selectedContentId === action.payload ? null : state.selectedContentId,
      };
    case 'HYDRATE_STATE':
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, defaultInitialState);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const storedContentItems = localStorage.getItem(LOCAL_STORAGE_CONTENT_ITEMS_KEY);
      const storedChatMessages = localStorage.getItem(LOCAL_STORAGE_CHAT_MESSAGES_KEY);
      const storedSelectedContentId = localStorage.getItem(LOCAL_STORAGE_SELECTED_CONTENT_ID_KEY);

      const loadedState: Partial<AppState> = {};

      if (storedContentItems) {
        loadedState.contentItems = JSON.parse(storedContentItems);
      }
      if (storedChatMessages) {
        // Dates are stored as ISO strings, convert back to Date objects
        loadedState.chatMessages = JSON.parse(storedChatMessages).map((msg: ChatMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
      if (storedSelectedContentId) {
        // localStorage stores "null" as a string, JSON.parse handles this
        const parsedId = JSON.parse(storedSelectedContentId);
        loadedState.selectedContentId = parsedId;
      }
      
      if (Object.keys(loadedState).length > 0) {
        dispatch({ type: 'HYDRATE_STATE', payload: loadedState });
      }

    } catch (error) {
      console.error("Error loading state from localStorage:", error);
      // Fallback to default initial state is implicitly handled by useReducer
    }
  }, []); // Empty dependency array: run only on mount

  // Save contentItems to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONTENT_ITEMS_KEY, JSON.stringify(state.contentItems));
    } catch (error) {
      console.error("Error saving contentItems to localStorage:", error);
    }
  }, [state.contentItems]);

  // Save chatMessages to localStorage when they change
  useEffect(() => {
    try {
      // Timestamps will be converted to ISO strings by JSON.stringify
      localStorage.setItem(LOCAL_STORAGE_CHAT_MESSAGES_KEY, JSON.stringify(state.chatMessages));
    } catch (error) {
      console.error("Error saving chatMessages to localStorage:", error);
    }
  }, [state.chatMessages]);

  // Save selectedContentId to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SELECTED_CONTENT_ID_KEY, JSON.stringify(state.selectedContentId));
    } catch (error) {
      console.error("Error saving selectedContentId to localStorage:", error);
    }
  }, [state.selectedContentId]);


  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
