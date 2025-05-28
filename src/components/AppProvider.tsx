
"use client";

import type { ContentItem, ChatMessage } from '@/lib/types';
import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';

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
  | { type: 'DELETE_CONTENT'; payload: string };

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
    default:
      return state;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, defaultInitialState);

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
