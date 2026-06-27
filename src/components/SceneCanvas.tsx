import { useEffect, useRef } from "react";
import * as THREE from "three";

export function SceneCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.5, 8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const coreGeometry = new THREE.IcosahedronGeometry(1.35, 3);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#f5fbff",
      roughness: 0.28,
      metalness: 0.58,
      emissive: "#0b2a31",
      emissiveIntensity: 0.25,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#4df0c8",
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });
    const ringOne = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.015, 12, 140), ringMaterial);
    const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.012, 12, 140), ringMaterial.clone());
    ringTwo.material.opacity = 0.36;
    ringOne.rotation.x = Math.PI / 2.8;
    ringTwo.rotation.y = Math.PI / 2.2;
    group.add(ringOne, ringTwo);

    const dotGeometry = new THREE.SphereGeometry(0.045, 12, 12);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: "#ffdc7a" });
    for (let i = 0; i < 70; i += 1) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const angle = i * 0.74;
      const radius = 2.7 + Math.sin(i) * 1.2;
      dot.position.set(Math.cos(angle) * radius, Math.sin(i * 0.41) * 1.8, Math.sin(angle) * radius);
      group.add(dot);
    }

    scene.add(new THREE.AmbientLight("#d6fff4", 1.2));
    const keyLight = new THREE.PointLight("#7df7d5", 35, 15);
    keyLight.position.set(4, 3, 5);
    scene.add(keyLight);
    const warmLight = new THREE.PointLight("#ffcc78", 18, 12);
    warmLight.position.set(-4, -2, 3);
    scene.add(warmLight);

    let scrollProgress = 0;
    let frame = 0;

    const handleScroll = () => {
      const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      scrollProgress = window.scrollY / maxScroll;
    };

    const handleResize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;
      group.rotation.y = time * 0.18 + scrollProgress * 4.2;
      group.rotation.x = Math.sin(time * 0.5) * 0.12 + scrollProgress * 0.8;
      core.scale.setScalar(1 + Math.sin(time * 1.4) * 0.035 + scrollProgress * 0.22);
      ringOne.rotation.z = time * 0.32;
      ringTwo.rotation.x = time * -0.18 + scrollProgress;
      camera.position.x = Math.sin(scrollProgress * Math.PI * 2) * 1.4;
      camera.position.y = 0.5 + scrollProgress * 1.4;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    handleResize();
    handleScroll();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      renderer.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      ringMaterial.dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="scene-canvas" ref={hostRef} aria-hidden="true" />;
}
