import { type ReactNode, useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell, LoadingState } from "@/components/travel-ui";
import { type AccountRole, useCurrentUser } from "@/lib/auth";
import ChooseRole from "@/pages/choose-role";
import Home from "@/pages/home";
import Bookings from "@/pages/bookings";
import Driver from "@/pages/driver";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#123f50",
    colorForeground: "#173b49",
    colorMutedForeground: "#66747a",
    colorDanger: "#a24d43",
    colorBackground: "#fffdf8",
    colorInput: "#fbf4e7",
    colorInputForeground: "#173b49",
    colorNeutral: "#dfd6c8",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-[#123f50]",
    headerSubtitle: "text-[#66747a]",
    socialButtonsBlockButtonText: "text-[#173b49] font-semibold",
    formFieldLabel: "text-[#173b49] font-semibold",
    footerActionLink: "text-[#b9583e] font-semibold",
    footerActionText: "text-[#66747a]",
    dividerText: "text-[#66747a]",
    identityPreviewEditButton: "text-[#b9583e]",
    formFieldSuccessText: "text-[#246a4e]",
    alertText: "text-[#a24d43]",
    logoBox: "mb-5",
    logoImage: "max-h-12",
    socialButtonsBlockButton: "border-[#dfd6c8] bg-[#fffdf8] hover:bg-[#fbf4e7]",
    formButtonPrimary: "bg-[#123f50] text-[#fffdf8] hover:bg-[#285b6b]",
    formFieldInput: "border-[#dfd6c8] bg-[#fbf4e7] text-[#173b49]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#dfd6c8]",
    alert: "border-[#e5b2aa] bg-[#fff3f0]",
    otpCodeFieldInput: "border-[#dfd6c8] bg-[#fbf4e7] text-[#173b49]",
    formFieldRow: "gap-1",
    main: "gap-5",
  },
};

const greekLocalization = {
  locale: "el-GR",
  socialButtonsBlockButton: "Συνέχεια με {{provider|titleize}}",
  dividerText: "ή",
  formFieldLabel__emailAddress: "Email",
  formFieldLabel__password: "Κωδικός",
  formFieldInputPlaceholder__emailAddress: "Το email σου",
  formFieldInputPlaceholder__password: "Ο κωδικός σου",
  formButtonPrimary: "Συνέχεια",
  formFieldAction__forgotPassword: "Ξέχασες τον κωδικό σου;",
  signIn: {
    start: {
      title: "Καλώς ήρθες ξανά",
      subtitle: "Συνδέσου για να συνεχίσεις στο Aperion",
      actionText: "Δεν έχεις λογαριασμό;",
      actionLink: "Εγγραφή",
    },
    password: {
      title: "Πληκτρολόγησε τον κωδικό σου",
      subtitle: "Συνέχισε με τον κωδικό του λογαριασμού σου",
    },
  },
  signUp: {
    start: {
      title: "Δημιούργησε λογαριασμό",
      subtitle: "Ξεκίνα να σχεδιάζεις τις επόμενες μέρες σου",
      actionText: "Έχεις ήδη λογαριασμό;",
      actionLink: "Σύνδεση",
    },
  },
};

function AuthLoading({ label = "Φορτώνουμε το Aperion…" }: { label?: string }) {
  return (
    <div className="min-h-[100dvh] bg-background px-5 py-12 md:px-10">
      <div className="mx-auto max-w-3xl">
        <LoadingState label={label} />
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        client.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useCurrentUser(Boolean(isSignedIn));

  if (!isLoaded || (isSignedIn && profile.isLoading)) return <AuthLoading />;
  if (isSignedIn && !profile.data?.role) return <Redirect to="/choose-role" />;
  if (isSignedIn) {
    const destination =
      profile.data?.role === "driver"
        ? "/driver"
        : profile.data?.role === "operator"
          ? "/admin"
          : "/bookings";
    return <Redirect to={destination} />;
  }

  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function RoleRoute({
  role,
  children,
}: {
  role: AccountRole;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useCurrentUser(Boolean(isSignedIn));

  if (!isLoaded || (isSignedIn && profile.isLoading)) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!profile.data?.role) return <Redirect to="/choose-role" />;
  if (profile.data.role !== role) return <Redirect to="/" />;

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

function ChooseRoleRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <ChooseRole />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function TravelerRoute() {
  return (
    <RoleRoute role="traveler">
      <Bookings />
    </RoleRoute>
  );
}

function DriverRoute() {
  return (
    <RoleRoute role="driver">
      <Driver />
    </RoleRoute>
  );
}

function OperatorRoute() {
  return (
    <RoleRoute role="operator">
      <Admin />
    </RoleRoute>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        appearance={clerkAppearance}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={greekLocalization}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      >
        <QueryClientProvider client={queryClient}>
          <ClerkQueryClientCacheInvalidator />
          <TooltipProvider>
            <RoutedErrorBoundary>
              <Switch>
                <Route path="/" component={HomeRoute} />
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/choose-role" component={ChooseRoleRoute} />
                <Route path="/bookings" component={TravelerRoute} />
                <Route path="/driver" component={DriverRoute} />
                <Route path="/admin" component={OperatorRoute} />
                <Route component={NotFound} />
              </Switch>
            </RoutedErrorBoundary>
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in the environment.");
  }
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;