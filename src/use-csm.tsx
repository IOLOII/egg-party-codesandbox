import { useThree } from "@react-three/fiber";
import { createContext, useContext, useRef } from "react";
import { Vector3 } from "three";
import CSM from "three-csm";

const csmContext = createContext<CSM>(null);

export const useCSM = () => {
  return useContext(csmContext);
};

export const CSMProvider = ({ children }) => {
  const { camera, scene } = useThree();

  const csm = useRef<CSM>();

  const get = () => {
    if (!csm.current) {
      csm.current = new CSM({
        maxFar: 100,
        cascades: 4,
        shadowMapSize: 1024,
        lightDirection: new Vector3(1, -1, 1).normalize(),
        camera: camera,
        parent: scene
      });
    }

    return csm.current;
  };

  return <csmContext.Provider value={get()}>{children}</csmContext.Provider>;
};
