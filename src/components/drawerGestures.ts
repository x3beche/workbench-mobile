/**
 * The gestures of the drawer that something inside a conversation takes
 * precedence over, handed down through context so the view that owns the
 * swipe can say so: a row's swipe to the left opens the row rather than
 * shutting the drawer (SwipeRow), and a conversation's top bar swiped to the
 * right shows the account's activity rather than pulling the drawer out
 * (ChatHeader).
 *
 * Their own module, so a test that mocks the row does not take the drawer's
 * gestures with it.
 */
import { createContext } from 'react';
import type { GestureType } from 'react-native-gesture-handler';

/** The drawer's swipe to shut it, which a row's swipe to the left wins over. */
export const DrawerGesture = createContext<GestureType | undefined>(undefined);

/** The drawer's swipe to pull it out, which a conversation's top bar wins over. */
export const DrawerPull = createContext<GestureType | undefined>(undefined);
