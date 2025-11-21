import type { Socket } from 'socket.io-client';

export class MovementNetwork {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    public sendPlayerMove(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }): void {
        this.socket.emit('playerMove', { position, rotation });
    }

    public onPlayerMove(callback: (data: any) => void): void {
        this.socket.on('playerMove', callback);
    }

    public offPlayerMove(): void {
        this.socket.off('playerMove');
    }
}
