import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

/**
 * PlayerInfoUI Component - WoW-style target frame
 * Shows selected player's name, health, and 3D preview
 */

interface PlayerInfoUIProps {
    playerName: string;
    health: number;
    maxHealth: number;
    playerMesh: BABYLON.Mesh | null;
    onClose: () => void;
}

export const PlayerInfoUI: React.FC<PlayerInfoUIProps> = ({ 
    playerName, 
    health, 
    maxHealth, 
    playerMesh,
    onClose 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<BABYLON.Engine | null>(null);
    const sceneRef = useRef<BABYLON.Scene | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !playerMesh) return;

        // Create mini scene for player preview
        const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
        engineRef.current = engine;

        const scene = new BABYLON.Scene(engine);
        sceneRef.current = scene;
        scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

        // Camera for preview
        const camera = new BABYLON.ArcRotateCamera(
            'previewCamera',
            Math.PI / 2,
            Math.PI / 3,
            5,
            new BABYLON.Vector3(0, 0.5, 0),
            scene
        );
        camera.attachControl(canvasRef.current, false);

        // Light
        const light = new BABYLON.HemisphericLight('previewLight', new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        // Clone player mesh for preview
        const clonedMesh = playerMesh.clone('previewMesh', null);
        if (clonedMesh) {
            clonedMesh.position = new BABYLON.Vector3(0, 0, 0);
            clonedMesh.rotation = new BABYLON.Vector3(0, 0, 0);

            // Add subtle rotation animation
            scene.registerBeforeRender(() => {
                if (clonedMesh) {
                    clonedMesh.rotation.y += 0.01;
                }
            });
        }

        // Render loop
        engine.runRenderLoop(() => {
            scene.render();
        });

        // Cleanup
        return () => {
            engine.dispose();
        };
    }, [playerMesh]);

    const healthPercent = (health / maxHealth) * 100;

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '280px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '2px solid #444',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            zIndex: 1000
        }}>
            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#fff',
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                ×
            </button>

            {/* Player name */}
            <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '10px',
                color: '#ffd700',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
            }}>
                {playerName}
            </div>

            {/* Health bar */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{
                    fontSize: '12px',
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>Health</span>
                    <span>{health} / {maxHealth}</span>
                </div>
                <div style={{
                    width: '100%',
                    height: '20px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid #555'
                }}>
                    <div style={{
                        width: `${healthPercent}%`,
                        height: '100%',
                        backgroundColor: healthPercent > 50 ? '#00ff00' : healthPercent > 25 ? '#ffaa00' : '#ff0000',
                        transition: 'width 0.3s ease',
                        boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.3)'
                    }} />
                </div>
            </div>

            {/* 3D Preview */}
            <div style={{
                width: '100%',
                height: '150px',
                backgroundColor: '#0a0a0f',
                borderRadius: '6px',
                border: '1px solid #555',
                overflow: 'hidden'
            }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                />
            </div>

            {/* Additional info */}
            <div style={{
                marginTop: '10px',
                fontSize: '11px',
                color: '#aaa',
                textAlign: 'center'
            }}>
                Click elsewhere to deselect
            </div>
        </div>
    );
};
