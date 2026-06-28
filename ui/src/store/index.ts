import { combineReducers, configureStore } from '@reduxjs/toolkit'

const rootReducer = combineReducers({
  _placeholder: (state: null = null) => state,
})

export const store = configureStore({
  reducer: rootReducer,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
