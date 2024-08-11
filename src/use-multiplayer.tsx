import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

type MultiplayerContext = {
  doc: Y.Doc;
  provider: WebrtcProvider;
};

const multiplayerContext = createContext<MultiplayerContext>(null);

export const useMultiplayer = () => useContext(multiplayerContext);

export const Multiplayer = ({
  children,
  room,
}: {
  children: ReactNode;
  room: string;
}) => {
  const docRef = useRef<MultiplayerContext>();

  const getDoc = () => {
    if (!docRef.current) {
      const doc = new Y.Doc();
      const provider = new WebrtcProvider(room, doc, {
        // signaling: ["wss://webrtc.on.hugos.computer"],
        // signaling: ["w00g0s404g80s4sgc0skc8k8.95.217.187.111.sslip.io"],
      });

      docRef.current = {
        doc,
        provider,
      };
    }

    return docRef.current;
  };

  useEffect(() => {
    const { doc, provider } = getDoc();

    return () => {
      doc.destroy();
      provider.destroy();
    };
  }, []);

  return (
    <multiplayerContext.Provider value={getDoc()}>
      {children}
    </multiplayerContext.Provider>
  );
};

export const useOtherPlayers = () => {
  const [players, setPlayers] = useState<number[]>([]);
  const multiplayer = useMultiplayer();

  const updatePlayerList = () => {
    const allStates = multiplayer.provider.awareness.getStates();

    setPlayers(() => {
      return Object.keys(Object.fromEntries(allStates))
        .filter((id) => Number(id) !== multiplayer.provider.awareness.clientID)
        .map((i) => Number(i));
    });
  };

  useEffect(() => {
    updatePlayerList();
    // const timer = setInterval(updatePlayerList, 1000);

    const handleAwarenessChange = (ctx) => {
      if (ctx.added.length) {
        setPlayers((curr) => [...curr, ...ctx.added]);
      }
      if (ctx.removed.length) {
        setPlayers((curr) => {
          return curr.filter((id) => !ctx.removed.includes(id));
        });
      }
    };

    multiplayer.provider.awareness.on("change", handleAwarenessChange);

    return () => {
      multiplayer.provider.awareness.off("change", handleAwarenessChange);
      // clearInterval(timer);
    };
  }, []);

  return players;
};

export const useLocalPlayer = () => {
  const multiplayer = useMultiplayer();

  return useMemo(() => {
    return {
      id: multiplayer.provider.awareness.clientID,
      get: () => multiplayer.provider.awareness.getLocalState(),
      set: (a, b) => multiplayer.provider.awareness.setLocalStateField(a, b),
    };
  }, [multiplayer]);
};

export const usePlayer = (id: number) => {
  const multiplayer = useMultiplayer();

  return useMemo(
    () => () => multiplayer.provider.awareness.getStates().get(id),
    [multiplayer, id]
  );
};
