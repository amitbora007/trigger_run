import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
const AuthContext = createContext(undefined);
// Demo user fixture for evaluation before Supabase credentials are input
const DEMO_USER = {
    id: '00000000-0000-0000-0000-000000000001',
    app_metadata: {},
    user_metadata: { full_name: 'Lead Site Reliability Engineer' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'sre@vigilapi.internal',
};
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);
    useEffect(() => {
        if (!isSupabaseConfigured) {
            setIsLoading(false);
            return;
        }
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });
        // Listen for auth state changes
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });
        return () => {
            subscription.unsubscribe();
        };
    }, []);
    const signIn = async (email, password) => {
        if (!isSupabaseConfigured) {
            return {
                error: new Error('Supabase credentials are not configured in environment variables. To explore without Supabase, click "Explore Sandbox Demo".'),
            };
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return { error: error };
        }
        setIsDemoMode(false);
        setUser(data.user);
        setSession(data.session);
        return { error: null };
    };
    const signUp = async (email, password) => {
        if (!isSupabaseConfigured) {
            return {
                error: new Error('Supabase credentials are not configured in environment variables. To explore without Supabase, click "Explore Sandbox Demo".'),
            };
        }
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error };
    };
    const signOut = async () => {
        setIsDemoMode(false);
        setUser(null);
        setSession(null);
        if (isSupabaseConfigured) {
            await supabase.auth.signOut();
        }
    };
    const enableDemoMode = () => {
        setIsDemoMode(true);
        setUser(DEMO_USER);
    };
    return (<AuthContext.Provider value={{
            user,
            session,
            isLoading,
            isDemoMode,
            signIn,
            signUp,
            signOut,
            enableDemoMode,
        }}>
      {children}
    </AuthContext.Provider>);
};
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
